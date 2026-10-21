import { replaceEmailLogoTokens } from "../../shared/email-branding";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export const renderEmailPreview = (html: string, subject: string, previewText: string, previewOrigin: string) => {
  const unsubscribeUrl = `${previewOrigin.replace(/\/$/, "")}/email/descadastrar/00000000-0000-4000-8000-000000000000`;
  const replacements: Record<string, string> = {
    "{{nome}}": "Maria",
    "{{email}}": "maria@exemplo.com.br",
    "{{assunto}}": escapeHtml(subject || "Assunto da campanha"),
    "{{unsubscribe_url}}": unsubscribeUrl,
  };
  let rendered = replaceEmailLogoTokens(html);
  Object.entries(replacements).forEach(([token, replacement]) => {
    rendered = rendered.split(token).join(replacement);
  });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewText)}</div>${rendered}</body></html>`;
};
