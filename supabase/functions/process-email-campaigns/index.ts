import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import type { ClaimedDelivery } from "./email-types.ts";
import { getProviderConfiguration } from "./email-config.ts";
import { buildUolSmtpMessage, connectAuthenticatedUolSmtp, runSmtpCommand, sendWithUolSmtp, type PreparedSmtpMessage } from "./uol-smtp.ts";
import { renderEmailHtml } from "./email-content.ts";
import { BeforeEmailSubmissionError, processClaimedEmailBatch } from "./batch-processor.ts";
import { archiveUolSentCopies } from "./uol-archive-worker.ts";
import { connectUolImap } from "./uol-imap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-email-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_ADMIN_EMAIL = "firetetraedro@gmail.com";

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const parseProviderError = async (response: Response) => {
  const responseText = await response.text();

  if (!responseText) {
    return `O provedor respondeu com HTTP ${response.status}.`;
  }

  try {
    const payload = JSON.parse(responseText) as Record<string, unknown>;
    const message = payload.message || payload.error || payload.detail;
    return typeof message === "string"
      ? message
      : `O provedor respondeu com HTTP ${response.status}.`;
  } catch {
    return responseText.slice(0, 1000);
  }
};

const sendWithProvider = async ({
  delivery,
  html,
  config,
  prepareCopy,
}: {
  delivery: ClaimedDelivery;
  html: string;
  config: ReturnType<typeof getProviderConfiguration>;
  prepareCopy: (message: PreparedSmtpMessage) => Promise<PreparedSmtpMessage>;
}) => {
  const unsubscribeUrl = `${config.publicAppUrl.replace(/\/$/, "")}/email/descadastrar/${delivery.unsubscribe_token}`;
  const commonHeaders = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
  };

  if (config.provider === "uol_smtp") {
    const message = buildUolSmtpMessage({ delivery, html, config });
    const prepared = config.uolSaveSentCopies ? await prepareCopy(message) : message;
    return sendWithUolSmtp({ delivery, html, config, prepared });
  }

  if (config.provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${delivery.sender_name} <${config.fromAddress}>`,
        to: [delivery.recipient_email],
        subject: delivery.subject,
        html,
        reply_to: delivery.reply_to || undefined,
        headers: commonHeaders,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseProviderError(response));
    }

    const payload = (await response.json()) as { id?: string };
    return payload.id || null;
  }

  if (config.provider === "generic_http") {
    const response = await fetch(config.genericApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.genericApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: config.fromAddress,
          name: delivery.sender_name,
        },
        to: {
          email: delivery.recipient_email,
          name: delivery.recipient_name,
        },
        reply_to: delivery.reply_to,
        subject: delivery.subject,
        html,
        headers: commonHeaders,
        metadata: {
          campaign_id: delivery.campaign_id,
          delivery_id: delivery.delivery_id,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(await parseProviderError(response));
    }

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message_id?: string;
    };
    return payload.id || payload.message_id || null;
  }

  throw new Error("Nenhum provedor de entrega de e-mail foi configurado.");
};

export const handler = async (request: Request) => {
  const requestStartedAt = Date.now();
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Metodo nao permitido." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: "Configuracao do Supabase incompleta." });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const workerToken = request.headers.get("x-email-worker-token") || "";
  let authorized = false;
  let authorizationMode: "cron" | "admin" | null = null;

  if (workerToken) {
    const { data: tokenIsValid, error: tokenError } = await adminClient.rpc(
      "verify_bulk_email_worker_token",
      { p_token: workerToken },
    );

    authorized = !tokenError && tokenIsValid === true;
    authorizationMode = authorized ? "cron" : null;
  }

  if (!authorized) {
    const authorization = request.headers.get("Authorization");

    if (authorization) {
      const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
      } = await callerClient.auth.getUser();

      authorized =
        user?.email?.trim().toLowerCase() === SYSTEM_ADMIN_EMAIL;
      authorizationMode = authorized ? "admin" : null;
    }
  }

  if (!authorized) {
    return jsonResponse(401, { error: "Chamada nao autorizada." });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "status" | "process" | "test_smtp" | "test_imap" | "archive_sent_copies";
  };
  const config = getProviderConfiguration();

  if (body.action === "status") {
    return jsonResponse(200, {
      configured: config.configured,
      provider: config.provider,
      from_address: config.fromAddress || null,
      from_address_configured: Boolean(config.fromAddress),
      public_app_url_configured: Boolean(config.publicAppUrl),
      smtp_host_configured: Boolean(config.uolSmtpHost),
      smtp_username_configured: Boolean(config.uolSmtpUsername),
      smtp_password_configured: Boolean(config.uolSmtpPassword),
      smtp_configured: config.smtpConfigured,
      uol_archive_enabled: config.provider === "uol_smtp" && config.uolSaveSentCopies,
      imap_configured: config.imapConfigured,
      authorization_mode: authorizationMode,
    });
  }

  if (body.action === "test_imap") {
    try {
      const session = await connectUolImap(config);
      try { return jsonResponse(200, { ok: true, folder: await session.sentFolder(config.uolSentFolder) }); }
      finally { session.close(); }
    } catch (error) {
      return jsonResponse(200, { ok: false, error: error instanceof Error ? error.message : "Falha no IMAP." });
    }
  }

  if (body.action === "test_smtp") {
    // A autorização já validou uma sessão de super admin ou o token interno do Vault.
    if (config.provider !== "uol_smtp" || !config.smtpConfigured) {
      return jsonResponse(200, {
        ok: false,
        error: "As secrets do transporte UOL SMTP ainda nao estao completas.",
      });
    }

    try {
      const connection = await connectAuthenticatedUolSmtp(config);
      try {
        await runSmtpCommand(connection, "QUIT", [221], "encerramento");
      } finally {
        connection.close();
      }
      return jsonResponse(200, { ok: true, provider: config.provider });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no SMTP.";
      return jsonResponse(200, { ok: false, error: message.slice(0, 500) });
    }
  }

  let archiveResult: Record<string, unknown>;
  try { archiveResult = await archiveUolSentCopies(adminClient, config); }
  catch (error) {
    archiveResult = { archived: 0, error: error instanceof Error ? error.message : "Falha no arquivamento UOL." };
    console.error("UOL archive pending:", archiveResult.error);
  }
  if (body.action === "archive_sent_copies") return jsonResponse(200, archiveResult);

  const workerId = crypto.randomUUID();
  const { error: recoveryError } = await adminClient.rpc("recover_interrupted_email_deliveries");
  if (recoveryError) {
    console.error("Error recovering interrupted email deliveries:", recoveryError);
    return jsonResponse(500, { error: "Nao foi possivel verificar entregas interrompidas. Nenhum envio iniciado." });
  }
  const { data: claimedRows, error: claimError } = await adminClient.rpc(
    "claim_due_email_campaign_batch",
    { p_worker_id: workerId },
  );

  if (claimError) {
    console.error("Error claiming email campaign batch:", claimError);
    return jsonResponse(500, { error: "Nao foi possivel reservar o proximo lote." });
  }

  const deliveries = (claimedRows || []) as ClaimedDelivery[];

  if (deliveries.length === 0) {
    return jsonResponse(200, {
      processed: 0,
      uol_archive: archiveResult,
      message: "Nenhum lote de campanha esta pendente neste momento.",
    });
  }

  const campaignId = deliveries[0].campaign_id;

  if (!config.configured) {
    const configurationError =
      "Transporte de e-mail ainda nao configurado. Defina EMAIL_PROVIDER, EMAIL_FROM_ADDRESS, PUBLIC_APP_URL e as credenciais do provedor.";
    await adminClient.rpc("block_email_campaign_batch", {
      p_worker_id: workerId,
      p_campaign_id: campaignId,
      p_error: configurationError,
    });

    return jsonResponse(200, {
      processed: 0,
      blocked: true,
      campaign_id: campaignId,
      message: configurationError,
    });
  }

  try {
    const result = await processClaimedEmailBatch({
      deliveries,
      budgetMs: Math.max(0, 60_000 - (Date.now() - requestStartedAt)),
      send: (delivery) => {
        const html = renderEmailHtml({ delivery, publicAppUrl: config.publicAppUrl });
        return sendWithProvider({ delivery, html, config, prepareCopy: async (message) => {
          const { data, error } = await adminClient.rpc("prepare_uol_sent_copy", {
            p_delivery_id: delivery.delivery_id, p_worker_id: workerId,
            p_message_id: message.messageId, p_mime_message: message.message,
          });
          const prepared = (data || [])[0];
          if (error || !prepared?.mime_message || !prepared?.message_id) {
            throw new BeforeEmailSubmissionError("Nao foi possivel preparar a copia UOL. Nenhum email foi submetido.");
          }
          return { messageId: prepared.message_id, message: prepared.mime_message };
        } });
      },
      persist: async (result) => {
        const { data, error } = await adminClient.rpc("finalize_email_campaign_batch", {
          p_worker_id: workerId, p_campaign_id: campaignId, p_results: [result],
        });
        if (error) throw error;
        return data;
      },
      halt: async (unstartedIds, errorMessage, block) => {
        const { data, error } = await adminClient.rpc("halt_email_campaign_batch", {
          p_worker_id: workerId, p_campaign_id: campaignId,
          p_unstarted_ids: unstartedIds, p_error: errorMessage, p_block: block,
        });
        if (error) throw error;
        return data;
      },
    });
    return jsonResponse(200, { ...result, campaign_id: campaignId, uol_archive: archiveResult });
  } catch (error) {
    console.error("Error checkpointing email campaign batch:", error);
    return jsonResponse(500, {
      error: "Processamento interrompido para preservar os resultados e evitar reenvios duplicados.",
      campaign_id: campaignId,
    });
  }
};

Deno.serve(handler);
