export const EMAIL_BRANDING_PUBLIC_URL = "https://www.firetetraedro.com.br";

/** URLs públicas e estáveis: anexos locais não podem ser carregados pelo destinatário. */
export const getEmailLogoUrls = (publicAppUrl = EMAIL_BRANDING_PUBLIC_URL) => ({
  logo_url: new URL("/email-assets/fire-360.jpg", publicAppUrl).href,
  holding_logo_url: new URL("/email-assets/fire-tetraedro.png", publicAppUrl).href,
});

/** A mesma substituição é usada pela prévia e pelo worker de envio. */
export const replaceEmailLogoTokens = (
  html: string,
  publicAppUrl = EMAIL_BRANDING_PUBLIC_URL,
) => {
  const urls = getEmailLogoUrls(publicAppUrl);
  return html.replace(/\{\{\s*(logo_url|holding_logo_url)\s*\}\}/g, (_token, key: keyof typeof urls) => urls[key]);
};
