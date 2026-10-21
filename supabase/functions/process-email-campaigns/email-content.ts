import type { ClaimedDelivery } from "./email-types.ts";
import { replaceEmailLogoTokens } from "../../../shared/email-branding.ts";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export const renderEmailHtml = ({ delivery, publicAppUrl }: {
  delivery: ClaimedDelivery;
  publicAppUrl: string;
}) => {
  const unsubscribeUrl = `${publicAppUrl.replace(/\/$/, "")}/email/descadastrar/${delivery.unsubscribe_token}`;
  const values: Record<string, string> = {
    "{{nome}}": escapeHtml(delivery.recipient_name || "cliente"),
    "{{email}}": escapeHtml(delivery.recipient_email),
    "{{assunto}}": escapeHtml(delivery.subject),
    "{{unsubscribe_url}}": unsubscribeUrl,
  };
  let html = replaceEmailLogoTokens(delivery.html_body, publicAppUrl);
  Object.entries(values).forEach(([token, value]) => {
    html = html.split(token).join(value);
  });
  const preheader = delivery.preview_text?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(delivery.preview_text.trim())}</div>`
    : "";
  const unsubscribeFooter = delivery.html_body.includes("{{unsubscribe_url}}")
    ? ""
    : `<div style="margin:32px auto 0;max-width:640px;padding:20px 16px;border-top:1px solid #e5e7eb;text-align:center;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b7280;">Você recebeu esta mensagem por constar em uma lista autorizada da Fire Tetraedro. <a href="${unsubscribeUrl}" style="color:#4b5563;text-decoration:underline;">Descadastrar este e-mail</a>.</div>`;
  return `${preheader}${html}${unsubscribeFooter}`;
};
