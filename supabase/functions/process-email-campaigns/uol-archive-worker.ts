import type { SupabaseClient } from "npm:@supabase/supabase-js@2.75.0";
import type { EmailProviderConfiguration } from "./email-config.ts";
import { connectUolImap } from "./uol-imap.ts";

export const archiveUolSentCopies = async (client: SupabaseClient, config: EmailProviderConfiguration) => {
  if (config.provider !== "uol_smtp" || !config.uolSaveSentCopies || !config.imapConfigured) {
    return { archived: 0, pending_errors: 0 };
  }
  const workerId = crypto.randomUUID();
  const { data, error } = await client.rpc("claim_uol_sent_copies", { p_worker_id: workerId, p_limit: 5 });
  if (error) throw new Error("Nao foi possivel consultar a fila de copias UOL.");
  const jobs = (data || []) as Array<{ delivery_id: string; message_id: string; mime_message: string }>;
  if (!jobs.length) return { archived: 0, pending_errors: 0 };
  let session: Awaited<ReturnType<typeof connectUolImap>> | null = null;
  let folder: string | null = null;
  let failure: string | null = null;
  let archived = 0;
  let pendingErrors = 0;
  try {
    try {
      session = await connectUolImap(config);
      folder = await session.sentFolder(config.uolSentFolder);
    } catch (error) {
      failure = error instanceof Error ? error.message : "Falha ao acessar o IMAP UOL.";
    }
    for (const job of jobs) {
      let uid: string | null = null;
      let saved = false;
      if (!failure && session && folder) {
        try { uid = (await session.save(folder, job.message_id, job.mime_message)).uid; saved = true; }
        catch (error) { failure = error instanceof Error ? error.message : "Falha ao arquivar a copia UOL."; }
      }
      const { data: finished, error: finishError } = await client.rpc("finish_uol_sent_copy", {
        p_delivery_id: job.delivery_id, p_worker_id: workerId, p_saved: saved,
        p_folder: folder, p_imap_uid: uid, p_error: saved ? null : failure,
      });
      if (finishError || finished !== true) throw new Error("Nao foi possivel registrar o arquivamento UOL. A proxima tentativa verificara o Message-ID sem reenviar o email.");
      if (saved) archived++; else pendingErrors++;
    }
    return { archived, pending_errors: pendingErrors, folder };
  } finally { session?.close(); }
};
