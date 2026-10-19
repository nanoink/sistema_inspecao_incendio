// Requer Playwright instalado (ou o caminho do módulo como primeiro argumento).
// Usa dados simulados e servidor local: não altera inspeções no Supabase.
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import assert from "node:assert/strict";

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright");
const bundle = await build({
  stdin: { contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { useChecklistLocation } from './src/hooks/useChecklistLocation';
    import { ChecklistLocationNotice } from './src/components/checklists/ChecklistLocationNotice';
    function Harness() {
      const [scope, setScope] = useState('inspection-a');
      const geo = useChecklistLocation(scope);
      return <><ChecklistLocationNotice {...geo} onRetry={geo.requestLocation} />
        <output id="location-state">{JSON.stringify({ scope, status: geo.status, location: geo.location })}</output>
        <button id="change-scope" onClick={() => setScope('inspection-b')}>Outra inspeção</button>
        <button id="leave" onClick={() => setScope(null)}>Sair</button>
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
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
const pageFor = async (context) => {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
};
const state = (page) => page.locator("#location-state").textContent().then(JSON.parse);
const waitStatus = (page, status) => page.waitForFunction((expected) => {
  const text = document.querySelector("#location-state")?.textContent;
  return text && JSON.parse(text).status === expected;
}, status);

try {
  browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const permitted = await browser.newContext({
    permissions: ["geolocation"], geolocation: { latitude: -1.455833, longitude: -48.503889, accuracy: 12 },
  });
  const page = await pageFor(permitted);
  await page.goto(url);
  await waitStatus(page, "captured");
  assert.equal((await state(page)).location.latitude, -1.455833);
  assert.equal((await state(page)).location.accuracy_m, 12);
  assert.equal(await page.locator('a[href^="https://www.google.com/maps/search/"]').count(), 1);
  await page.getByRole("button", { name: "Atualizar localização" }).click();
  await waitStatus(page, "captured");
  assert.equal((await state(page)).location.longitude, -48.503889);
  await permitted.close();
  console.log("PASS: native browser geolocation, permission granted, Maps link, retry.");

  const denied = await browser.newContext();
  await denied.addInitScript(() => Object.defineProperty(navigator, "geolocation", { value: {
    getCurrentPosition(_success, failure) { failure({ code: 1 }); },
  } }));
  const deniedPage = await pageFor(denied);
  await deniedPage.goto(url);
  await waitStatus(deniedPage, "denied");
  assert.equal((await state(deniedPage)).location, null);
  assert.ok(await deniedPage.getByText(/Libere a localização/).isVisible());
  assert.ok(await deniedPage.getByRole("button", { name: "Tentar localização" }).isEnabled());
  assert.equal(await deniedPage.locator('a[href*="google.com/maps"]').count(), 0);
  await denied.close();
  console.log("PASS: denied permission is explained; no false coordinates or Maps link.");

  const delayed = await browser.newContext();
  await delayed.addInitScript(() => {
    window.pendingLocations = [];
    Object.defineProperty(navigator, "geolocation", { value: {
      getCurrentPosition(success, failure, options) { window.pendingLocations.push({ success, failure, options }); },
    } });
  });
  const delayedPage = await pageFor(delayed);
  await delayedPage.goto(url);
  await waitStatus(delayedPage, "requesting");
  await delayedPage.locator("#change-scope").click();
  await delayedPage.waitForFunction(() => window.pendingLocations.length === 2);
  await delayedPage.evaluate(() => window.pendingLocations[0].success({
    coords: { latitude: 1, longitude: 2, accuracy: 3 }, timestamp: Date.now(),
  }));
  assert.equal((await state(delayedPage)).scope, "inspection-b");
  assert.equal((await state(delayedPage)).location, null);
  await delayedPage.evaluate(() => window.pendingLocations[1].success({
    coords: { latitude: -10, longitude: -40, accuracy: 8 }, timestamp: Date.now(),
  }));
  await waitStatus(delayedPage, "captured");
  assert.equal((await state(delayedPage)).location.latitude, -10);
  await delayedPage.locator("#leave").click();
  await waitStatus(delayedPage, "idle");
  assert.equal((await state(delayedPage)).location, null);
  await delayed.close();
  assert.deepEqual(errors, []);
  console.log("PASS: changing/leaving a checklist clears location and ignores stale callbacks; no browser errors.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
