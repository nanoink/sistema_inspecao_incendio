type DeliveryProvider = "disabled" | "resend" | "generic_http" | "uol_smtp";

export const getProviderConfiguration = () => {
  const provider = (Deno.env.get("EMAIL_PROVIDER") || "disabled") as DeliveryProvider;
  const fromAddress = (Deno.env.get("EMAIL_FROM_ADDRESS") || "").trim();
  const publicAppUrl = (Deno.env.get("PUBLIC_APP_URL") || "").trim();
  const resendApiKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const genericApiUrl = (Deno.env.get("EMAIL_DELIVERY_API_URL") || "").trim();
  const genericApiToken = (Deno.env.get("EMAIL_DELIVERY_API_TOKEN") || "").trim();
  const uolSmtpHost = (Deno.env.get("UOL_SMTP_HOST") || "smtps.uhserver.com").trim();
  const parsedUolSmtpPort = Number(Deno.env.get("UOL_SMTP_PORT") || "465");
  const uolSmtpPort = parsedUolSmtpPort;
  const uolSmtpUsername = (Deno.env.get("UOL_SMTP_USERNAME") || "").trim();
  const uolSmtpPassword = Deno.env.get("UOL_SMTP_PASSWORD") || "";
  const uolImapHost = (Deno.env.get("UOL_IMAP_HOST") || "imap.uhserver.com").trim();
  const uolImapPort = Number(Deno.env.get("UOL_IMAP_PORT") || "993");
  const uolImapUsername = (Deno.env.get("UOL_IMAP_USERNAME") || uolSmtpUsername).trim();
  const uolImapPassword = Deno.env.get("UOL_IMAP_PASSWORD") || uolSmtpPassword;
  const uolSentFolder = (Deno.env.get("UOL_SENT_FOLDER") || "").trim();
  const uolSaveSentCopies = Deno.env.get("UOL_SAVE_SENT_COPIES") !== "false";
  const imapConfigured = Boolean(uolImapHost && uolImapPort === 993 && uolImapUsername && uolImapPassword);

  const smtpConfigured = Boolean(
    uolSmtpHost && uolSmtpUsername && uolSmtpPassword && uolSmtpPort === 465,
  );
  const configured =
    Boolean(fromAddress && publicAppUrl) &&
    ((provider === "resend" && Boolean(resendApiKey)) ||
      (provider === "generic_http" && Boolean(genericApiUrl && genericApiToken)) ||
      (provider === "uol_smtp" && smtpConfigured));

  return {
    provider,
    fromAddress,
    publicAppUrl,
    resendApiKey,
    genericApiUrl,
    genericApiToken,
    uolSmtpHost,
    uolSmtpPort,
    uolSmtpUsername,
    uolSmtpPassword,
    uolImapHost, uolImapPort, uolImapUsername, uolImapPassword,
    uolSentFolder, uolSaveSentCopies, imapConfigured,
    smtpConfigured,
    configured,
  };
};

export type EmailProviderConfiguration = ReturnType<typeof getProviderConfiguration>;
