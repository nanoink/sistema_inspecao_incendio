// In-memory Supabase boundary for tests. Never connects to a real service.
export const COMPANY = "00000000-0000-4000-8000-000000000001";
export const CYCLE = "00000000-0000-4000-8000-000000000002";
export const ATTACHMENT = {
  id: "00000000-0000-4000-8000-000000000003", title: "Planta de teste",
  file_bucket: "empresa-relatorio-anexos", file_path: `${COMPANY}/report-attachments/${CYCLE}/planta.png`,
  file_name: "planta.png", mime_type: "image/png", size_bytes: 100,
};

export function createReportFixture({ legacy = false } = {}) {
  const copy = (value) => structuredClone(value);
  const state = { rows: [], reads: 0, writes: 0, beforeWrite: null, readError: null, failWrites: false };
  let version = 0;
  const stamp = () => new Date(Date.UTC(2026, 9, 27, 0, 0, ++version)).toISOString();
  const client = {
    async rpc(name) {
      if (!name.startsWith("get_or_create_") || !name.endsWith("report_cycle")) throw new Error(`Unexpected RPC: ${name}`);
      return { data: [{ id: CYCLE }], error: null };
    },
    from(table) {
      if (table !== "empresa_relatorios") throw new Error(`Unexpected table: ${table}`);
      let action = "read", patch, selected = "*";
      const filters = [];
      const execute = async () => {
        if (legacy && (filters.some(([key]) => key === "relatorio_ciclo_id") || patch?.relatorio_ciclo_id)) {
          return { data: null, error: { code: "42703", message: "column relatorio_ciclo_id does not exist" } };
        }
        if (action === "read") {
          state.reads++;
          if (state.readError) return { data: null, error: state.readError };
        } else {
          if (state.beforeWrite) {
            const beforeWrite = state.beforeWrite;
            state.beforeWrite = null;
            beforeWrite(state);
          }
          if (state.failWrites) return { data: null, error: new Error("Network unavailable") };
        }
        let row = state.rows.find((candidate) => filters.every(([key, value]) => candidate[key] === value));
        if (action === "insert") {
          if (state.rows.some((candidate) => candidate.empresa_id === patch.empresa_id && candidate.relatorio_ciclo_id === patch.relatorio_ciclo_id)) {
            return { data: null, error: { code: "23505" } };
          }
          row = { id: `report-${version + 1}`, status: "rascunho", dados_adicionais: {}, ...copy(patch), updated_at: stamp() };
          state.rows.push(row);
          state.writes++;
        } else if (action === "update" && row) {
          Object.assign(row, copy(patch), { updated_at: stamp() });
          state.writes++;
        }
        return { data: row ? (selected === "id" ? { id: row.id } : copy(row)) : null, error: null };
      };
      const query = {
        select(value) { selected = value || "*"; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        update(value) { action = "update"; patch = value; return query; },
        insert(value) { action = "insert"; patch = value; return query; },
        maybeSingle: execute, single: execute,
      };
      return query;
    },
  };
  return { client, state };
}
