// Read-only by default. --append-test saves ONE clearly labelled test copy in
// the sender's Sent folder; it never connects to SMTP or submits an email.
import { getProviderConfiguration } from "../supabase/functions/process-email-campaigns/email-config.ts";
import { buildUolSmtpMessage } from "../supabase/functions/process-email-campaigns/uol-smtp.ts";
import { connectUolImap } from "../supabase/functions/process-email-campaigns/uol-imap.ts";

const config = getProviderConfiguration();
const session = await connectUolImap(config);
try {
  const folder = await session.sentFolder(config.uolSentFolder);
  console.log(JSON.stringify({ authenticated: true, folder }));
  if (Deno.args.includes("--append-test")) {
    const message = buildUolSmtpMessage({ config,
      delivery: {
        delivery_id: crypto.randomUUID(), campaign_id: "archive-validation-only",
        recipient_email: config.uolImapUsername, recipient_name: "Validacao interna, sem envio",
        unsubscribe_token: crypto.randomUUID(), subject: "TESTE Fire 360 - copia em Enviados, nenhum email enviado",
        preview_text: null, html_body: "", sender_name: "Fire 360 - teste de arquivamento", reply_to: null,
      },
      html: "<h2>Validacao do arquivamento Fire 360</h2><p>Esta mensagem foi apenas salva na pasta de enviados por IMAP. Nenhum email foi enviado por SMTP e nenhum destinatario recebeu esta mensagem.</p>",
    });
    const saved = await session.save(folder, message.messageId, message.message);
    const repeated = await session.save(folder, message.messageId, message.message);
    if (saved.uid !== repeated.uid || !repeated.alreadyPresent) throw new Error("Validacao de idempotencia falhou.");
    console.log(JSON.stringify({ test_copy_saved: true, folder, uid: saved.uid, duplicate_prevented: true, smtp_submissions: 0 }));
  }
} finally { session.close(); }
