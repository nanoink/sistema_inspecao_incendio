// Real admin page/dialog with read-only fixtures; no SMTP, Edge Function process,
// real recipients, or database writes are permitted.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright");
const bundle = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import BulkEmailAdminPage from './src/pages/BulkEmailAdminPage';createRoot(document.getElementById('root')).render(<MemoryRouter><BulkEmailAdminPage/></MemoryRouter>);`, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic",
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) }, loader: { ".png": "dataurl", ".svg": "dataurl" }, define: { "process.env.NODE_ENV": '"test"' },
  plugins: [{ name: "read-only-email-fixtures", setup(build) {
    build.onResolve({ filter: /(?:integrations[/\\]supabase[/\\]client|hooks[/\\]useAuth|hooks[/\\]use-toast)(?:\.tsx?)?$/ }, (args) => ({ path: args.path, namespace: "fixtures" }));
    build.onLoad({ filter: /.*/, namespace: "fixtures" }, (args) => ({ contents:
      args.path.includes("useAuth") ? `const user={id:'fixture-admin',email:'firetetraedro@gmail.com'};export const useAuth=()=>({user,isSystemAdmin:true});` :
      args.path.includes("use-toast") ? `const toast=()=>{};export const useToast=()=>({toast});` : `
      const campaign={id:'fixture',name:'Campanha de teste',subject:'Diagnostico',status:'blocked',total_recipients:2412,sent_count:824,failed_count:1488,skipped_count:0,uncertain_count:100,batch_size:50,interval_minutes:10,last_error:'100 envios sem confirmacao',created_at:'2026-10-20',updated_at:'2026-10-21'};
      export const supabase={from(table){let filter='all';const q={select(){return q},order(){return q},eq(key,value){if(key==='status')filter=value;return q},
        async range(start,end){const total=filter==='failed'?1488:filter==='sent'?2:100;return {data:Array.from({length:Math.min(end-start+1,total-start)},(_,n)=>({id:'delivery-'+(start+n+1),recipient_email:'recipient'+(start+n+1)+'@example.invalid',status:filter==='failed'?'failed':filter==='sent'?'sent':'uncertain',last_error:filter==='failed'?'SMTP senha falhou (código 535).':filter==='sent'?null:'Execucao interrompida sem confirmacao',updated_at:'2026-10-21T00:00:00Z',sent_at:null,provider_message_id:null,uol_archive_status:n===0?'saved':'error',uol_archive_folder:'Itens Enviados',uol_archive_error:'Falha IMAP simulada'})),count:total,error:null}},
        then(resolve,reject){return Promise.resolve({data:table==='email_campaigns'?[campaign]:[],error:null}).then(resolve,reject)}};return q;},
        functions:{async invoke(name,options){if(options?.body?.action!=='status')throw new Error('Sending blocked in test');return {data:{configured:true,provider:'uol_smtp',from_address:'sender@example.invalid'},error:null}}}};`, loader: "js" }));
  } }],
});
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/test.js" ? "text/javascript" : "text/html; charset=utf-8");
  response.end(request.url === "/test.js" ? bundle.outputFiles[0].text : '<!doctype html><html><body><div id="root"></div><script type="module" src="/test.js"></script></body></html>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByText("96% processado", { exact: true }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Retomar", exact: true }).isDisabled());
  await page.getByRole("button", { name: "Ver resultados", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("recipient1@example.invalid", { exact: true }).waitFor();
  assert.equal(await dialog.locator("article").count(), 25);
  await dialog.getByRole("button", { name: "Próxima", exact: true }).click();
  await dialog.getByText("recipient26@example.invalid", { exact: true }).waitFor();
  await page.getByLabel("Filtrar resultados de envio").click();
  await page.getByRole("option", { name: "Falha", exact: true }).click();
  await dialog.getByText("recipient1@example.invalid", { exact: true }).waitFor();
  assert.ok(await dialog.getByText("SMTP senha falhou (código 535).", { exact: true }).count());
  await page.getByLabel("Filtrar resultados de envio").click();
  await page.getByRole("option", { name: "Aceito pelo servidor", exact: true }).click();
  await dialog.getByText("Cópia salva no UOL: Itens Enviados", { exact: true }).waitFor();
  assert.ok(await dialog.getByText("Cópia UOL pendente de nova tentativa: Falha IMAP simulada", { exact: true }).count());
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: 96% is processed, uncertain campaign cannot resume, real results dialog lists recipients, paginates and filters failures. No sends or writes.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
