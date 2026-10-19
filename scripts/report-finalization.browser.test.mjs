// Requer Playwright, ou os caminhos do módulo e do Chromium como argumentos.
// Interface isolada e callbacks simulados: não faz gravações no Supabase.
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import assert from "node:assert/strict";

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright");
const bundle = await build({
  stdin: { contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ReportToolbar } from './src/components/reports/ReportToolbar';
    function Harness() {
      const [finalized, setFinalized] = useState(false);
      const [saving, setSaving] = useState(false);
      const [allowed, setAllowed] = useState(true);
      const [calls, setCalls] = useState({ finalizations: 0, newCycles: 0 });
      return <><ReportToolbar navigateBack={() => {}} onSync={() => {}} onPrint={() => {}}
        onSaveDraft={() => {}} onFinalize={() => { setFinalized(true); setCalls(c => ({...c, finalizations:c.finalizations+1})); }}
        onStartNewCycle={() => setCalls(c => ({...c, newCycles:c.newCycles+1}))}
        saving={saving} snapshotIsCurrent={true} statusLabel={finalized?'Finalizado':'Rascunho'}
        finalizeLabel="Finalizar relatorio operacional" showStartNewCycle={allowed && finalized} />
        <output id="calls">{JSON.stringify(calls)}</output>
        <button id="toggle-saving" onClick={() => setSaving(s => !s)}>Salvar em andamento</button>
        <button id="revoke" onClick={() => setAllowed(false)}>Sem permissão de novo ciclo</button>
      </>;
    }
    createRoot(document.getElementById('root')).render(<Harness />);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic",
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  define: { "process.env.NODE_ENV": '"test"' },
});
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/test.js" ? "text/javascript" : "text/html; charset=utf-8");
  response.end(request.url === "/test.js" ? bundle.outputFiles[0].text : '<!doctype html><html lang="pt-BR"><body><div id="root"></div><script type="module" src="/test.js"></script></body></html>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const actions = page.getByTestId("report-actions").getByRole("button");
  const calls = () => page.locator("#calls").textContent().then(JSON.parse);
  await actions.nth(3).click();
  assert.equal(await actions.nth(3).textContent(), "Finalizar relatorio operacional");
  assert.equal((await calls()).newCycles, 0);
  await actions.nth(3).dblclick();
  assert.equal((await calls()).newCycles, 0);
  assert.equal(await page.getByRole("alertdialog").count(), 0);
  console.log("PASS: finalize keeps its position; repeated/double clicks never start a new cycle.");

  await page.getByRole("button", { name: "Encerrar ciclo e iniciar novo", exact: true }).click();
  await page.getByRole("alertdialog").waitFor();
  assert.equal((await calls()).newCycles, 0);
  await page.getByRole("button", { name: "Cancelar e manter ciclo atual" }).click();
  assert.equal((await calls()).newCycles, 0);
  await page.getByRole("button", { name: "Encerrar ciclo e iniciar novo", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar início de novo ciclo" }).click();
  assert.equal((await calls()).newCycles, 1);
  console.log("PASS: only explicit confirmation starts a new cycle; cancel preserves the current cycle.");

  await page.locator("#toggle-saving").click();
  for (const button of await actions.all()) assert.ok(await button.isDisabled());
  await page.locator("#toggle-saving").click();
  await page.locator("#revoke").click();
  assert.equal(await page.getByRole("button", { name: "Encerrar ciclo e iniciar novo", exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: mutation buttons disabled while saving; new-cycle action hidden without permission; no browser errors.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
