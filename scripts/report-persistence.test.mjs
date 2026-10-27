import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { createReportFixture, COMPANY, CYCLE, ATTACHMENT } from "./report-persistence.fixture.mjs";

const bundled = await build({
  entryPoints: ["src/lib/report-cycles.ts"], bundle: true, write: false, platform: "node", format: "esm",
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});
const { upsertCompanyReportForCycle: save, loadActiveCompanyReport: load, clearActiveReportCycleCache: clear } =
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const fixture = (options) => { clear(); return createReportFixture(options); };

test("checklist save and fresh report load preserve attachments, ART and other metadata", async () => {
  const { client } = fixture();
  await save(client, COMPANY, { dados_adicionais: { art_file_path: "company/art.pdf", report_mode: "tecnico" } }, { attachmentChange: { add: ATTACHMENT } });
  await save(client, COMPANY, { titulo: "Relatorio de Inspecao", status: "rascunho", checklist_snapshot: { total: 10 } }, { editableCycle: true, select: "id" });
  clear();
  const { report } = await load(client, COMPANY);
  assert.deepEqual(report.dados_adicionais.report_attachments, [ATTACHMENT]);
  assert.equal(report.dados_adicionais.art_file_path, "company/art.pdf");
  assert.equal(report.dados_adicionais.report_mode, "tecnico");
  assert.equal(report.dados_adicionais.report_cycle_id, CYCLE);
});

test("partial report metadata patches preserve files and explicitly clear only requested fields", async () => {
  const { client } = fixture();
  await save(client, COMPANY, { dados_adicionais: { art_file_path: "art.pdf", custom: "original" } }, { attachmentChange: { add: ATTACHMENT } });
  const { report } = await save(client, COMPANY, { status: "finalizado", dados_adicionais: { custom: null } });
  assert.deepEqual(report.dados_adicionais.report_attachments, [ATTACHMENT]);
  assert.equal(report.dados_adicionais.art_file_path, "art.pdf");
  assert.equal(report.dados_adicionais.custom, null);
  assert.equal(report.status, "finalizado");
});

test("concurrent uploads retry with latest metadata instead of losing either attachment", async () => {
  const { client, state } = fixture();
  await save(client, COMPANY, {}, { attachmentChange: { add: ATTACHMENT } });
  state.beforeWrite = ({ rows }) => {
    rows[0].dados_adicionais.report_attachments.push({ ...ATTACHMENT, id: "another-tab", file_path: "other.png" });
    rows[0].updated_at = "2026-10-27T00:01:00.000Z";
  };
  const { report } = await save(client, COMPANY, {}, { attachmentChange: { add: { ...ATTACHMENT, id: "third", file_path: "third.png" } } });
  assert.deepEqual(report.dados_adicionais.report_attachments.map((entry) => entry.id), [ATTACHMENT.id, "another-tab", "third"]);
  assert.equal(state.writes, 2);
});

test("only explicit removal removes the requested attachment, keeping concurrent additions and ART", async () => {
  const { client, state } = fixture();
  await save(client, COMPANY, { dados_adicionais: { art_file_path: "art.pdf" } }, { attachmentChange: { add: ATTACHMENT } });
  state.beforeWrite = ({ rows }) => {
    rows[0].dados_adicionais.report_attachments.push({ ...ATTACHMENT, id: "another-tab" });
    rows[0].updated_at = "2026-10-27T00:01:00.000Z";
  };
  const { report } = await save(client, COMPANY, {}, { attachmentChange: { removeId: ATTACHMENT.id } });
  assert.deepEqual(report.dados_adicionais.report_attachments.map((entry) => entry.id), ["another-tab"]);
  assert.equal(report.dados_adicionais.art_file_path, "art.pdf");
});

test("idempotent attachment insertion and separate cycle isolation", async () => {
  const { client, state } = fixture();
  state.rows.push({ id: "old", empresa_id: COMPANY, relatorio_ciclo_id: "closed-cycle", dados_adicionais: { archived: true }, updated_at: "old" });
  for (let i = 0; i < 2; i++) await save(client, COMPANY, {}, { attachmentChange: { add: ATTACHMENT } });
  assert.deepEqual(state.rows[0].dados_adicionais, { archived: true });
  assert.equal((await load(client, COMPANY)).report.dados_adicionais.report_attachments.length, 1);
});

test("legacy schema fallback also preserves metadata", async () => {
  const { client } = fixture({ legacy: true });
  await save(client, COMPANY, { dados_adicionais: { art_file_path: "legacy.pdf" } }, { attachmentChange: { add: ATTACHMENT } });
  const { report } = await save(client, COMPANY, { checklist_snapshot: {} });
  assert.deepEqual(report.dados_adicionais.report_attachments, [ATTACHMENT]);
  assert.equal(report.dados_adicionais.art_file_path, "legacy.pdf");
});

test("read/permission failures never fall through to an overwrite", async () => {
  const { client, state } = fixture();
  state.readError = { code: "42501", message: "Permission denied" };
  await assert.rejects(save(client, COMPANY, {}), { code: "42501" });
  assert.equal(state.writes, 0);
});

test("insert race retries against existing row and retains its metadata", async () => {
  const { client, state } = fixture();
  state.beforeWrite = ({ rows }) => rows.push({ id: "inserted-elsewhere", empresa_id: COMPANY, relatorio_ciclo_id: CYCLE, dados_adicionais: { art_file_path: "concurrent.pdf" }, updated_at: "original" });
  const { report } = await save(client, COMPANY, {}, { attachmentChange: { add: ATTACHMENT } });
  assert.equal(report.id, "inserted-elsewhere");
  assert.equal(report.dados_adicionais.art_file_path, "concurrent.pdf");
  assert.deepEqual(report.dados_adicionais.report_attachments, [ATTACHMENT]);
});
