// Interface real com Supabase simulado: nenhum envio ou gravação é permitido.
// Args: módulo Playwright, executável Chromium, caminho do template; --live usa as imagens públicas.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import assert from "node:assert/strict";
import { renderEmailHtml } from "../supabase/functions/process-email-campaigns/email-content.ts";

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright");
const template = process.argv[4] ? fs.readFileSync(process.argv[4], "utf8") : '<img src="{{logo_url}}" alt="FIRE 360"><p>Olá, {{nome}}</p><img src="{{holding_logo_url}}" alt="Fire Tetraedro"><a href="{{unsubscribe_url}}">Sair</a>';
const output = fs.mkdtempSync(path.join(os.tmpdir(), "fire360-email-preview-"));
const bundle = await build({
  stdin: { contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router-dom';
    import BulkEmailAdminPage from './src/pages/BulkEmailAdminPage';
    createRoot(document.getElementById('root')).render(<MemoryRouter><BulkEmailAdminPage /></MemoryRouter>);
  `, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic",
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  loader: { ".png": "dataurl", ".svg": "dataurl" },
  define: { "process.env.NODE_ENV": '"test"' },
  plugins: [{ name: "readonly-fixtures", setup(build) {
    build.onResolve({ filter: /(?:integrations[/\\]supabase[/\\]client|hooks[/\\]useAuth|hooks[/\\]use-toast)(?:\.tsx?)?$/ }, (args) => ({ path: args.path, namespace: "fixtures" }));
    build.onLoad({ filter: /.*/, namespace: "fixtures" }, (args) => ({ contents:
      args.path.includes("useAuth") ? `const user={id:'00000000-0000-4000-8000-000000000001',email:'admin@example.invalid'}; export const useAuth=()=>({user,isSystemAdmin:true});` :
      args.path.includes("use-toast") ? `const toast=()=>{}; export const useToast=()=>({toast});` : `
        export const supabase={
          from(name){ const builder={select(){return builder},order(){return builder},
            then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}}; return builder; },
          functions:{async invoke(name,options){if(options?.body?.action!=='status') throw new Error('Envio bloqueado no teste');
            return {data:{configured:true,provider:'uol_smtp',from_address:'fixture@example.invalid',from_address_configured:true,public_app_url_configured:true},error:null};}}
        };`, loader: "js" }));
  } }],
});
const cssFile = fs.readdirSync("dist/assets").find((name) => /^index-.*\.css$/.test(name));
const css = cssFile ? fs.readFileSync(`dist/assets/${cssFile}`, "utf8") : "";
const server = createServer((request, response) => {
  if (request.url === "/test.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle.outputFiles[0].text); }
  else if (request.url === "/test.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end('<!doctype html><html lang="pt-BR"><head><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script type="module" src="/test.js"></script></body></html>'); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  if (!process.argv.includes("--live")) await context.route("https://www.firetetraedro.com.br/email-assets/*", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    if (!["fire-360.jpg", "fire-tetraedro.png"].includes(name)) return route.abort();
    return route.fulfill({ path: `public/email-assets/${name}`, contentType: name.endsWith(".jpg") ? "image/jpeg" : "image/png" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole("tab", { name: "Criar e-mail" }).click();
  await page.locator("#html-body").fill(template);
  const frame = page.frameLocator('iframe[title="Pre-visualizacao do e-mail"]');
  const checkImages = async (locator) => {
    const images = await locator.evaluateAll((nodes) => Promise.all(nodes.map(async (image) => {
      await image.decode();
      return { src: image.src, naturalWidth: image.naturalWidth, width: image.getBoundingClientRect().width };
    })));
    assert.equal(images.length, 2);
    assert.ok(images.every((image) => image.naturalWidth > 0 && image.width > 0));
    assert.ok(images.every((image) => image.src.startsWith("https://www.firetetraedro.com.br/email-assets/")));
    return images;
  };
  await frame.getByAltText("FIRE 360", { exact: true }).waitFor();
  const desktop = await checkImages(frame.locator("img"));
  await page.locator('iframe[title="Pre-visualizacao do e-mail"]').screenshot({ path: path.join(output, "preview-desktop.png") });
  await frame.getByAltText("Fire Tetraedro", { exact: true }).evaluate((image) => image.scrollIntoView({ behavior: "instant", block: "center" }));
  await page.locator('iframe[title="Pre-visualizacao do e-mail"]').screenshot({ path: path.join(output, "preview-footer.png") });
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  const mobile = await checkImages(frame.locator("img"));
  assert.ok(mobile.every((image) => image.width <= 290));
  await frame.getByAltText("FIRE 360", { exact: true }).evaluate((image) => image.scrollIntoView({ behavior: "instant", block: "start" }));
  await page.locator('iframe[title="Pre-visualizacao do e-mail"]').screenshot({ path: path.join(output, "preview-mobile.png") });

  const mailPage = await context.newPage();
  const deliveredHtml = renderEmailHtml({ publicAppUrl: "https://www.firetetraedro.com.br", delivery: {
    html_body: template, recipient_name: "Empresa Teste", recipient_email: "fixture@example.invalid",
    subject: "Teste local", preview_text: "", unsubscribe_token: "00000000-0000-4000-8000-000000000000",
  } });
  await mailPage.setContent(deliveredHtml);
  const worker = await checkImages(mailPage.locator("img"));
  assert.ok((await mailPage.locator("body").textContent()).includes("Empresa Teste"));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ desktop, mobile, worker, screenshotDirectory: output, liveAssets: process.argv.includes("--live"), campaignsSent: 0 }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
