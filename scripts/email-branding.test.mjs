import { test } from "node:test";
import assert from "node:assert/strict";
import { getEmailLogoUrls, replaceEmailLogoTokens } from "../shared/email-branding.ts";
import { renderEmailHtml } from "../supabase/functions/process-email-campaigns/email-content.ts";
import { build } from "esbuild";

test("as duas logos usam arquivos públicos HTTPS, não caminhos locais", () => {
  const urls = getEmailLogoUrls();
  assert.equal(urls.logo_url, "https://www.firetetraedro.com.br/email-assets/fire-360.jpg");
  assert.equal(urls.holding_logo_url, "https://www.firetetraedro.com.br/email-assets/fire-tetraedro.png");
});

test("substitui as variáveis do template sem consumir as variáveis pessoais", () => {
  const template = '<p>{{nome}}</p><img src="{{logo_url}}"><img src="{{holding_logo_url}}"><a href="{{unsubscribe_url}}">Sair</a>';
  const rendered = replaceEmailLogoTokens(template);
  assert.ok(!rendered.includes("{{logo_url}}"));
  assert.ok(!rendered.includes("{{holding_logo_url}}"));
  assert.ok(rendered.includes('{{nome}}'));
  assert.ok(rendered.includes('{{unsubscribe_url}}'));
  assert.ok(rendered.includes('src="https://www.firetetraedro.com.br/email-assets/fire-360.jpg"'));
  assert.ok(rendered.includes('src="https://www.firetetraedro.com.br/email-assets/fire-tetraedro.png"'));
});

test("aceita espaços nas variáveis e mantém os demais links intactos", () => {
  const rendered = replaceEmailLogoTokens('<img src="{{ logo_url }}"><img src="{{ holding_logo_url }}"><a href="https://wa.me/559184177279">WhatsApp</a>');
  assert.equal((rendered.match(/\/email-assets\//g) || []).length, 2);
  assert.ok(rendered.includes('href="https://wa.me/559184177279"'));
});

test("resolve os arquivos a partir da raiz pública sem depender da rota do editor", () => {
  const urls = getEmailLogoUrls("https://example.com/admin/emails/");
  assert.equal(urls.logo_url, "https://example.com/email-assets/fire-360.jpg");
  assert.equal(urls.holding_logo_url, "https://example.com/email-assets/fire-tetraedro.png");
});

const template = '<img src="{{logo_url}}" alt="FIRE 360"><p>Olá, {{nome}}.</p><img src="{{holding_logo_url}}" alt="Fire Tetraedro"><a href="{{unsubscribe_url}}">Sair</a>';
const delivery = {
  html_body: template, subject: "Segurança", recipient_name: 'Empresa <Teste> & "Filhos"',
  recipient_email: "contato@example.invalid", preview_text: "Resumo <teste>",
  unsubscribe_token: "00000000-0000-4000-8000-000000000000",
};

test("o renderer real do worker resolve logos, preserva personalização e descadastro", () => {
  const html = renderEmailHtml({ delivery, publicAppUrl: "https://www.firetetraedro.com.br" });
  assert.ok(!/\{\{(?:logo_url|holding_logo_url|nome|unsubscribe_url)\}\}/.test(html));
  assert.ok(html.includes("Empresa &lt;Teste&gt; &amp; &quot;Filhos&quot;"));
  assert.ok(html.includes("Resumo &lt;teste&gt;"));
  assert.ok(html.includes("/email-assets/fire-360.jpg"));
  assert.ok(html.includes("/email-assets/fire-tetraedro.png"));
  assert.equal((html.match(/email\/descadastrar\//g) || []).length, 1);
});

test("o worker continua adicionando descadastro em templates antigos sem o link", () => {
  const html = renderEmailHtml({ delivery: { ...delivery, html_body: "<p>Olá, {{nome}}</p>", recipient_name: null }, publicAppUrl: "https://www.firetetraedro.com.br" });
  assert.ok(html.includes("Olá, cliente"));
  assert.ok(html.includes("Descadastrar este e-mail"));
});

const bundle = await build({ entryPoints: ["src/lib/email-preview.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { renderEmailPreview } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("a prévia usa as mesmas URLs públicas do envio mesmo em ambiente local", () => {
  const preview = renderEmailPreview(template, "Teste", "Resumo", "http://localhost:5173");
  const sent = renderEmailHtml({ delivery, publicAppUrl: "https://www.firetetraedro.com.br" });
  for (const url of Object.values(getEmailLogoUrls())) {
    assert.ok(preview.includes(url));
    assert.ok(sent.includes(url));
  }
  assert.ok(preview.includes("Olá, Maria"));
  assert.ok(preview.includes("http://localhost:5173/email/descadastrar/"));
});
