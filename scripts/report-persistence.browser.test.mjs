// Real CompanyReport, real persistence functions; in-memory/localStorage boundaries.
// Never accesses Supabase, UOL, or any real company.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright");
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7i8AAAAASUVORK5CYII=";
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const bundle = await build({
  stdin: { loader: "tsx", resolveDir: process.cwd(), contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {MemoryRouter,Routes,Route,Link} from 'react-router-dom';
    import CompanyReport from './src/pages/CompanyReport';
    import {upsertCompanyReportForCycle} from './src/lib/report-cycles';
    import {supabase} from '@/integrations/supabase/client';
    window.__saveChecklist=()=>upsertCompanyReportForCycle(supabase,'00000000-0000-4000-8000-000000000001',
      {titulo:'Relatorio de Inspecao',status:'rascunho',checklist_snapshot:{}},{editableCycle:true,select:'id'});
    function App(){return <MemoryRouter initialEntries={['/relatorios/00000000-0000-4000-8000-000000000001']}>
      <nav><Link to="/outra" id="leave-report">Sair do relatório</Link> | <Link to="/relatorios/00000000-0000-4000-8000-000000000001" id="return-report">Voltar ao relatório</Link></nav>
      <Routes><Route path="/relatorios/:id" element={<CompanyReport/>}/><Route path="/outra" element={<p id="other-page">Outra página</p>}/></Routes>
    </MemoryRouter>};
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic",
  alias: { "@": sourceRoot }, loader: { ".png": "dataurl", ".svg": "dataurl" },
  define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
  plugins: [{ name: "report-boundary-fixtures", setup(build) {
    const fixtures = {
      "@/hooks/useAuth": `const user={id:'fixture-admin',email:'firetetraedro@gmail.com'};export const useAuth=()=>({user,email:user.email,isSystemAdmin:true});`,
      "@/hooks/use-toast": `const toast=(value)=>{(window.__toasts??=[]).push(value)};export const useToast=()=>({toast});`,
      "@/lib/checklist-source": `export const loadChecklistData=async()=>({models:[],groupsByModel:new Map(),responses:new Map()});`,
      "@/lib/checklist-non-conformities": `export const loadAllChecklistNonConformitiesForActiveCycle=async()=>[];`,
      "@/lib/company-members": `export * from ${JSON.stringify(sourceRoot + "/lib/company-members.ts")};export const loadCompanyMembers=async()=>[];export const loadCompanyReportSignatures=async()=>[];`,
      "@/lib/pdf-preview": `export const releasePdfPreviewImages=()=>{};export const renderPdfPreviewImages=async()=>({pageCount:1,images:['data:image/png;base64,${png}']});`,
      "@/integrations/supabase/client": `
        import {createReportFixture,COMPANY} from './scripts/report-persistence.fixture.mjs';
        const {client,state}=createReportFixture();
        state.rows=JSON.parse(localStorage.getItem('test-reports')||'[]');
        const from=client.from.bind(client);
        const commit=()=>localStorage.setItem('test-reports',JSON.stringify(state.rows));
        const files=JSON.parse(localStorage.getItem('test-files')||'{}');
        client.from=(table)=>{
          if(table==='empresa_relatorios'){
            const builder=from(table);
            for(const name of ['single','maybeSingle']){const execute=builder[name];builder[name]=async()=>{const result=await execute();commit();return result;};}
            return builder;
          }
          const company={id:COMPANY,razao_social:'Empresa fictícia',cnpj:'00000000000000',responsavel:'Teste',telefone:'',email:'test@example.invalid',cidade:'Belém',estado:'PA',area_m2:100,numero_ocupantes:1,possui_responsavel_tecnico:false,possui_atrio:false};
          if(!['empresa','empresa_exigencias','empresa_extintores','empresa_hidrantes','empresa_luminarias'].includes(table))throw new Error('Unexpected table '+table);
          const query={select(){return query},eq(){return query},order(){return query},
            async maybeSingle(){return {data:company,error:null}},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return query;
        };
        client.storage={from(bucket){return {
          async upload(path,file){files[bucket+'/'+path]={name:file.name,size:file.size};localStorage.setItem('test-files',JSON.stringify(files));return {data:{path},error:null}},
          async createSignedUrls(paths){window.__signedCalls=(window.__signedCalls||0)+1;return {data:paths.map(path=>({path,signedUrl:files[bucket+'/'+path]?'data:image/png;base64,${png}':null})),error:null}},
          async createSignedUrl(){return {data:null,error:null}},
          async download(path){return {data:files[bucket+'/'+path]?new Blob(['fixture']):null,error:null}},
          async remove(paths){paths.forEach(path=>delete files[bucket+'/'+path]);localStorage.setItem('test-files',JSON.stringify(files));return {data:[],error:null}}
        }}};
        window.__reportFixture={state,files};export const supabase=client;
      `,
    };
    build.onResolve({ filter: /^@\// }, (args) => Object.hasOwn(fixtures, args.path) ? { path: args.path, namespace: "fixtures" } : null);
    build.onLoad({ filter: /.*/, namespace: "fixtures" }, (args) => ({ contents: fixtures[args.path], loader: "js", resolveDir: process.cwd() }));
  } }],
});
const cssName = fs.existsSync("dist/assets") ? fs.readdirSync("dist/assets").find((name) => /^index-.*\.css$/.test(name)) : null;
const css = cssName ? fs.readFileSync(`dist/assets/${cssName}`, "utf8") : "";
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/test.js" ? "text/javascript" : request.url === "/test.css" ? "text/css" : "text/html; charset=utf-8");
  response.end(request.url === "/test.js" ? bundle.outputFiles[0].text : request.url === "/test.css" ? css : '<!doctype html><html lang="pt-BR"><head><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script type="module" src="/test.js"></script></body></html>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const upload = async (title, name, mimeType, bytes) => {
    await page.locator("#reportAttachmentTitle").fill(title);
    await page.locator("#reportAttachmentFile").setInputFiles({ name, mimeType, buffer: bytes });
    await page.getByRole("button", { name: "Adicionar anexo", exact: true }).click();
    await page.waitForFunction((fileName) => window.__reportFixture.state.rows.some((row) => row.dados_adicionais.report_attachments?.some((file) => file.file_name === fileName)), name);
    await page.waitForFunction(() => window.__toasts?.at(-1)?.title === "Anexo enviado");
  };
  await upload("Planta persistente", "planta.png", "image/png", Buffer.from(png, "base64"));
  await upload("PDF persistente", "laudo.pdf", "application/pdf", Buffer.from("%PDF-1.4\nfixture"));
  await page.locator("#leave-report").click();
  await page.locator("#other-page").waitFor();
  await page.evaluate(() => window.__saveChecklist());
  await page.locator("#return-report").click();
  await page.locator("#reportAttachmentTitle").waitFor();
  assert.ok(await page.getByText("planta.png", { exact: true }).count());
  assert.ok(await page.getByText("laudo.pdf", { exact: true }).count());
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.waitForFunction(() => window.__toasts?.at(-1)?.title === "Relatorio salvo");
  await page.reload();
  await page.locator("#reportAttachmentTitle").waitFor();
  assert.ok(await page.getByText("planta.png", { exact: true }).count());
  assert.ok(await page.getByText("laudo.pdf", { exact: true }).count());
  await page.waitForFunction(() => window.__signedCalls > 0);
  assert.equal(await page.evaluate(() => document.querySelectorAll('a[href^="blob:"]').length), 0);
  const attached = await page.evaluate(() => window.__reportFixture.state.rows[0].dados_adicionais.report_attachments);
  assert.equal(attached.length, 2);
  assert.ok(attached.every((file) => file.file_path && !file.file_path.startsWith("blob:")));
  await page.getByRole("button", { name: "Remover", exact: true }).first().click();
  await page.waitForFunction(() => window.__reportFixture.state.rows[0].dados_adicionais.report_attachments.length === 1);
  await page.reload();
  await page.locator("#reportAttachmentTitle").waitFor();
  assert.equal(await page.getByText("planta.png", { exact: true }).count(), 0);
  assert.ok(await page.getByText("laudo.pdf", { exact: true }).count());
  assert.deepEqual(errors, []);
  console.log("PASS: real image/PDF upload controls → persistence → leave report → save checklist → reopen → save draft → full reload → refreshed links → explicit removal only. No external requests.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
