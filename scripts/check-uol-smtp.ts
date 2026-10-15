import { connectAuthenticatedUolSmtp } from "../supabase/functions/process-email-campaigns/uol-smtp.ts";
import { getProviderConfiguration } from "../supabase/functions/process-email-campaigns/email-config.ts";

const config = getProviderConfiguration();

if (config.provider !== "uol_smtp" || !config.smtpConfigured) {
  console.error("Preencha as variáveis UOL_SMTP_* no arquivo privado da função. A porta segura deve ser 465.");
  Deno.exit(1);
}

try {
  const connection = await connectAuthenticatedUolSmtp(config);
  connection.close();
  console.log("UOL SMTP: conexão TLS e autenticação confirmadas.");
  console.log(`Conta: ${config.uolSmtpUsername}`);
  console.log(`Remetente: ${config.fromAddress || "pendente"}`);
  console.log("Nenhum e-mail foi enviado. O teste não acessou o Supabase.");
  if (!config.publicAppUrl) {
    console.log("Campanhas aguardam PUBLIC_APP_URL para gerar os links de descadastro.");
  }
} catch (error) {
  // Mensagens do cliente SMTP contêm apenas etapa/código, nunca as credenciais.
  console.error(error instanceof Error ? error.message : "Falha na conexão SMTP.");
  Deno.exit(1);
}
