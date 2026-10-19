import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import {
  buildChecklistMapsUrl,
  captureChecklistLocation,
  formatChecklistCoordinates,
  normalizeChecklistLocation,
} from "../src/lib/checklist-location.ts";

const location = { latitude: -1.455833, longitude: -48.503889, accuracy_m: 8.4, captured_at: "2026-10-19T14:30:00.000Z" };

test("normaliza coordenadas, preservando o hemisfério e o horário da captura", () => {
  assert.deepEqual(normalizeChecklistLocation(location), location);
  assert.equal(formatChecklistCoordinates(location), "-1.455833, -48.503889");
  assert.ok(normalizeChecklistLocation({ ...location, latitude: 0, longitude: 0, accuracy_m: 0 }));
});

test("rejeita dados ausentes, fora do intervalo ou não numéricos", () => {
  for (const invalid of [null, {}, [], "<script>",
    { ...location, latitude: 91 }, { ...location, longitude: -181 },
    { ...location, latitude: NaN }, { ...location, longitude: Infinity },
    { ...location, latitude: "-1.455833" }, { ...location, accuracy_m: -1 },
    { ...location, accuracy_m: Infinity }, { ...location, captured_at: "inválido" },
  ]) assert.equal(normalizeChecklistLocation(invalid), null);
});

test("link do Google Maps usa apenas números validados, sem chave de API", () => {
  const url = new URL(buildChecklistMapsUrl(location));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.pathname, "/maps/search/");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("query"), "-1.455833,-48.503889");
  assert.equal(url.searchParams.has("key"), false);
  assert.equal(buildChecklistMapsUrl({ ...location, latitude: "javascript:alert(1)" }), null);
  assert.equal(buildChecklistMapsUrl(null), null);
});

test("solicita posição nova e precisa pela API do navegador", async () => {
  let requestedOptions;
  const result = await captureChecklistLocation({ secureContext: true, geolocation: {
    getCurrentPosition(success, _error, options) {
      requestedOptions = options;
      success({ coords: { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy_m }, timestamp: Date.parse(location.captured_at) });
    },
  } });
  assert.equal(result.status, "captured");
  assert.deepEqual(result.location, location);
  assert.deepEqual(requestedOptions, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
});

for (const [code, status] of [[1, "denied"], [2, "unavailable"], [3, "timeout"]]) {
  test(`falha de geolocalização ${code}: ${status}, sem inventar coordenadas`, async () => {
    const result = await captureChecklistLocation({ secureContext: true, geolocation: {
      getCurrentPosition(_success, error) { error({ code }); },
    } });
    assert.deepEqual(result, { status, location: null });
  });
}

test("sem HTTPS ou suporte não tenta localizar por IP", async () => {
  assert.equal((await captureChecklistLocation({ secureContext: false })).status, "insecure");
  assert.equal((await captureChecklistLocation({ secureContext: true, geolocation: null })).status, "unsupported");
});

test("permissão pendente não bloqueia indefinidamente nem aceita resultado tardio", async () => {
  let onSuccess;
  const result = await captureChecklistLocation({ secureContext: true, timeoutMs: 5, geolocation: {
    getCurrentPosition(success) { onSuccess = success; },
  } });
  assert.deepEqual(result, { status: "timeout", location: null });
  onSuccess({ coords: { latitude: 0, longitude: 0, accuracy: 1 }, timestamp: Date.now() });
  assert.deepEqual(result, { status: "timeout", location: null });
});

test("posição inválida e erro do dispositivo não quebram o checklist", async () => {
  for (const geolocation of [
    { getCurrentPosition() { throw new Error("device unavailable"); } },
    { getCurrentPosition(success) { success({ coords: { latitude: 100, longitude: 0, accuracy: 1 }, timestamp: Date.now() }); } },
    { getCurrentPosition(success) { success({ coords: {}, timestamp: NaN }); } },
  ]) assert.equal((await captureChecklistLocation({ secureContext: true, geolocation })).status, "unavailable");
});

// O bundle em memória permite testar os mesmos módulos usados pelo Vite, incluindo @/.
const bundle = await build({
  entryPoints: ["src/lib/checklist.ts"], bundle: true, write: false,
  platform: "node", format: "esm", alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});
const checklist = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("snapshot e mapa de auditoria preservam a localização por item", () => {
  const snapshot = checklist.buildChecklistSnapshot(
    [{ id: "model", codigo: "A.1", nome: "Inspeção" }],
    new Map([["model", [{ id: "group", modelId: "model", title: "Seção", type: "grupo", order: 1, items: [
      { id: "item", groupId: "group", description: "Teste", kind: "item", evaluable: true, order: 1 },
    ] }]]]),
    new Map([["item", { checklist_item_id: "item", status: "C", observacoes: null, localizacao: location }]]),
  );
  assert.deepEqual(snapshot.inspections[0].itens[0].localizacao, location);
  assert.deepEqual(checklist.buildChecklistSnapshotAuditMap(snapshot).get("item").localizacao, location);
});

test("nova execução sem GPS não herda coordenadas do snapshot anterior", () => {
  const previous = { localizacao: location, preenchido_em: "2026-10-18T12:00:00Z" };
  const base = { checklist_item_id: "item", status: "C", observacoes: null };
  assert.equal(checklist.mergeChecklistResponseWithAudit({ ...base, localizacao: null }, previous).localizacao, null);
  assert.equal(checklist.mergeChecklistResponseWithAudit({ ...base, preenchido_em: "2026-10-19T12:00:00Z" }, previous).localizacao, null);
  assert.deepEqual(checklist.mergeChecklistResponseWithAudit({ ...base, preenchido_em: previous.preenchido_em }, previous).localizacao, location);
});

const equipmentBundle = await build({
  entryPoints: ["src/lib/checklist-equipment.ts"], bundle: true, write: false,
  platform: "node", format: "esm", alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});
const equipment = await import(`data:text/javascript;base64,${Buffer.from(equipmentBundle.outputFiles[0].text).toString("base64")}`);
const equipmentSnapshot = {
  inspection_code: "A.23", inspection_name: "Extintor", generated_at: location.captured_at,
  items: [{ checklist_item_id: "item", item_numero: "1", item_exibicao: "1", secao: "Teste",
    descricao: "Teste", status: "C", observacoes: null, localizacao: location }],
};

test("normalização e edição dos checklists QR preservam as coordenadas", () => {
  const normalized = equipment.normalizeEquipmentChecklistSnapshot(equipmentSnapshot);
  assert.deepEqual(normalized.items[0].localizacao, location);
  assert.deepEqual(equipment.updateEquipmentChecklistSnapshotItem(normalized, "item", { status: "NC" }).items[0].localizacao, location);
  assert.equal(equipment.normalizeEquipmentChecklistSnapshot({ ...equipmentSnapshot,
    items: [{ ...equipmentSnapshot.items[0], localizacao: { ...location, latitude: 95 } }],
  }).items[0].localizacao, null);
});

test("sincronizar modelo preserva GPS; reiniciar checklist remove coordenadas antigas", () => {
  const templateSnapshot = equipment.normalizeEquipmentChecklistSnapshot(equipmentSnapshot);
  assert.deepEqual(equipment.mergeEquipmentChecklistSnapshotWithTemplate({
    existingSnapshot: equipmentSnapshot, templateSnapshot, mode: "preserve",
  }).items[0].localizacao, location);
  const reset = equipment.mergeEquipmentChecklistSnapshotWithTemplate({
    existingSnapshot: equipmentSnapshot, templateSnapshot, mode: "overwrite",
  });
  assert.equal(reset.items[0].status, "P");
  assert.equal(reset.items[0].localizacao, null);
});
