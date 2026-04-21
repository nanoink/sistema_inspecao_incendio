import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type ChecklistGroupWithItems,
  type ChecklistItemShape,
  type ChecklistModelShape,
  type ChecklistResponseShape,
} from "@/lib/checklist";
import {
  resolveActiveReportCycleId,
  resolveEditableReportCycleId,
} from "@/lib/report-cycles";
import { isMissingColumnError } from "@/lib/supabase-errors";

type AppSupabaseClient = SupabaseClient<Database>;

interface ChecklistResponseRow {
  checklist_item_id: string;
  relatorio_ciclo_id?: string | null;
  status: string;
  observacoes: string | null;
  preenchido_por_nome?: string | null;
  preenchido_por_user_id?: string | null;
  preenchido_em?: string | null;
  updated_at: string;
}

interface LoadedChecklistData {
  models: ChecklistModelShape[];
  groupsByModel: Map<string, ChecklistGroupWithItems[]>;
  responses: Map<string, ChecklistResponseShape>;
}

const buildResponsesMap = (
  rows: ChecklistResponseRow[] | null,
) => {
  const responses = new Map<string, ChecklistResponseShape>();

  rows?.forEach((row) => {
    if (responses.has(row.checklist_item_id)) {
      return;
    }

    responses.set(row.checklist_item_id, {
      checklist_item_id: row.checklist_item_id,
      status: row.status,
      observacoes: row.observacoes,
      preenchido_por_nome: row.preenchido_por_nome ?? null,
      preenchido_por_user_id: row.preenchido_por_user_id ?? null,
      preenchido_em: row.preenchido_em ?? null,
    });
  });

  return responses;
};

export const loadChecklistResponses = async (
  supabase: AppSupabaseClient,
  companyId?: string,
) => {
  if (!companyId) {
    return new Map<string, ChecklistResponseShape>();
  }

  const activeReportCycleId = await resolveActiveReportCycleId(supabase, companyId);

  let responsesQuery = supabase
    .from("empresa_checklist_respostas")
    .select(
      "checklist_item_id, relatorio_ciclo_id, status, observacoes, preenchido_por_nome, preenchido_por_user_id, preenchido_em, updated_at",
    )
    .eq("empresa_id", companyId)
    .order("updated_at", { ascending: false });

  if (activeReportCycleId) {
    responsesQuery = responsesQuery.eq("relatorio_ciclo_id", activeReportCycleId);
  }

  const responsesResult = await responsesQuery;

  if (
    responsesResult.error &&
    isMissingColumnError(responsesResult.error, [
      "relatorio_ciclo_id",
      "preenchido_por_nome",
      "preenchido_por_user_id",
      "preenchido_em",
    ])
  ) {
    const fallbackResponsesResult = await supabase
      .from("empresa_checklist_respostas")
      .select("checklist_item_id, status, observacoes, updated_at")
      .eq("empresa_id", companyId)
      .order("updated_at", { ascending: false });

    if (fallbackResponsesResult.error) {
      throw fallbackResponsesResult.error;
    }

    return buildResponsesMap(
      fallbackResponsesResult.data as ChecklistResponseRow[] | null,
    );
  }

  if (responsesResult.error) {
    throw responsesResult.error;
  }

  return buildResponsesMap(responsesResult.data as ChecklistResponseRow[] | null);
};

export const loadChecklistData = async (
  supabase: AppSupabaseClient,
  companyId?: string,
) : Promise<LoadedChecklistData> => {
  const modelsResult = await supabase
    .from("checklist_modelos")
    .select("id, codigo, nome, titulo, tipo, ordem")
    .eq("ativo", true)
    .eq("tipo", "renovacao")
    .order("ordem", { ascending: true });

  if (modelsResult.error) {
    throw modelsResult.error;
  }

  const models = (modelsResult.data || []).map((model) => ({
    id: model.id,
    codigo: model.codigo,
    nome: model.nome,
    titulo: model.titulo,
    tipo: model.tipo,
    ordem: model.ordem,
  }));

  if (models.length === 0) {
    return {
      models: [],
      groupsByModel: new Map(),
      responses: new Map(),
    };
  }

  const modelIds = models.map((model) => model.id);
  const groupsResult = await supabase
    .from("checklist_grupos")
    .select("id, modelo_id, titulo, tipo, ordem")
    .in("modelo_id", modelIds)
    .order("ordem", { ascending: true });

  if (groupsResult.error) {
    throw groupsResult.error;
  }

  const groups = groupsResult.data || [];
  const groupIds = groups.map((group) => group.id);
  const itemsResult = groupIds.length
    ? await supabase
        .from("checklist_itens_modelo")
        .select("id, grupo_id, numero_original, descricao, complemento, tipo, avaliavel, ordem")
        .in("grupo_id", groupIds)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const itemsByGroup = new Map<string, ChecklistItemShape[]>();
  (itemsResult.data || []).forEach((item) => {
    const current = itemsByGroup.get(item.grupo_id) || [];
    current.push({
      id: item.id,
      groupId: item.grupo_id,
      originalNumber: item.numero_original,
      description: item.descricao,
      complement: item.complemento,
      kind: item.tipo,
      evaluable: item.avaliavel,
      order: item.ordem,
    });
    itemsByGroup.set(item.grupo_id, current);
  });

  const groupsByModel = new Map<string, ChecklistGroupWithItems[]>();
  groups.forEach((group) => {
    const current = groupsByModel.get(group.modelo_id) || [];
    current.push({
      id: group.id,
      modelId: group.modelo_id,
      title: group.titulo,
      type: group.tipo,
      order: group.ordem,
      items: itemsByGroup.get(group.id) || [],
    });
    groupsByModel.set(group.modelo_id, current);
  });

  return {
    models,
    groupsByModel,
    responses: await loadChecklistResponses(supabase, companyId),
  };
};

export const saveChecklistResponses = async ({
  supabase,
  companyId,
  responses,
  evaluableIds,
}: {
  supabase: AppSupabaseClient;
  companyId: string;
  responses: Map<string, ChecklistResponseShape>;
  evaluableIds: Set<string>;
}) => {
  const editableReportCycleId = await resolveEditableReportCycleId(
    supabase,
    companyId,
  );
  const payload = Array.from(responses.values())
    .filter((response) => evaluableIds.has(response.checklist_item_id))
    .map((response) => ({
      empresa_id: companyId,
      relatorio_ciclo_id: editableReportCycleId ?? undefined,
      checklist_item_id: response.checklist_item_id,
      status: response.status,
      observacoes: response.observacoes,
      preenchido_por_nome: response.preenchido_por_nome ?? null,
      preenchido_por_user_id: response.preenchido_por_user_id ?? null,
      preenchido_em: response.preenchido_em ?? null,
    }));

  if (editableReportCycleId) {
    const existingRowsResult = await supabase
      .from("empresa_checklist_respostas")
      .select("checklist_item_id")
      .eq("empresa_id", companyId)
      .eq("relatorio_ciclo_id", editableReportCycleId)
      .in("checklist_item_id", Array.from(evaluableIds));

    if (
      existingRowsResult.error &&
      !isMissingColumnError(existingRowsResult.error, ["relatorio_ciclo_id"])
    ) {
      throw existingRowsResult.error;
    }

    if (!existingRowsResult.error) {
      const payloadItemIds = new Set(payload.map((item) => item.checklist_item_id));
      const staleItemIds = (existingRowsResult.data || [])
        .map((row) => row.checklist_item_id)
        .filter((itemId) => !payloadItemIds.has(itemId));

      if (staleItemIds.length > 0) {
        const { error: staleDeleteError } = await supabase
          .from("empresa_checklist_respostas")
          .delete()
          .eq("empresa_id", companyId)
          .eq("relatorio_ciclo_id", editableReportCycleId)
          .in("checklist_item_id", staleItemIds);

        if (staleDeleteError) {
          throw staleDeleteError;
        }
      }

      if (payload.length > 0) {
        const { error: upsertError } = await supabase
          .from("empresa_checklist_respostas")
          .upsert(payload, {
            onConflict:
              "empresa_id,relatorio_ciclo_id,checklist_item_id",
          });

        if (upsertError) {
          throw upsertError;
        }
      }

      return;
    }
  }

  const { error: deleteError } = await supabase
    .from("empresa_checklist_respostas")
    .delete()
    .eq("empresa_id", companyId);

  if (deleteError) {
    throw deleteError;
  }

  if (payload.length > 0) {
    const { error: insertError } = await supabase
      .from("empresa_checklist_respostas")
      .insert(payload);

    if (
      insertError &&
      isMissingColumnError(insertError, [
        "relatorio_ciclo_id",
        "preenchido_por_nome",
        "preenchido_por_user_id",
        "preenchido_em",
      ])
    ) {
      const legacyPayload = payload.map(
        ({
          empresa_id,
          checklist_item_id,
          status,
          observacoes,
          relatorio_ciclo_id: _relatorio_ciclo_id,
        }) => ({
          empresa_id,
          checklist_item_id,
          status,
          observacoes,
        }),
      );

      const { error: legacyInsertError } = await supabase
        .from("empresa_checklist_respostas")
        .insert(legacyPayload);

      if (legacyInsertError) {
        throw legacyInsertError;
      }

      return;
    }

    if (insertError) {
      throw insertError;
    }
  }
};
