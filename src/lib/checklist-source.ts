import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type ChecklistGroupWithItems,
  type ChecklistItemShape,
  type ChecklistModelShape,
  type ChecklistResponseShape,
} from "@/lib/checklist";
import {
  buildLegacyChecklistRows,
  type LegacyChecklistItemShape,
} from "@/lib/checklist-legacy";
import { isMissingRelationError } from "@/lib/supabase-errors";

type AppSupabaseClient = SupabaseClient<Database>;
type ChecklistResponseTable = "empresa_checklist_respostas" | "empresa_checklist";

interface ChecklistResponseRow {
  checklist_item_id: string;
  status: string;
  observacoes: string | null;
  updated_at: string;
}

interface LoadedChecklistData {
  source: "normalized" | "legacy";
  models: ChecklistModelShape[];
  groupsByModel: Map<string, ChecklistGroupWithItems[]>;
  responses: Map<string, ChecklistResponseShape>;
  responseTable: ChecklistResponseTable;
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
    });
  });

  return responses;
};

const loadNormalizedChecklistData = async (
  supabase: AppSupabaseClient,
  companyId?: string,
) => {
  const modelsResult = await supabase
    .from("checklist_modelos")
    .select("id, codigo, nome, titulo, tipo, ordem")
    .eq("ativo", true)
    .eq("tipo", "renovacao")
    .order("ordem", { ascending: true });

  if (modelsResult.error) {
    if (isMissingRelationError(modelsResult.error, "checklist_modelos")) {
      return null;
    }

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
    return null;
  }

  const modelIds = models.map((model) => model.id);
  const groupsResult = await supabase
    .from("checklist_grupos")
    .select("id, modelo_id, titulo, tipo, ordem")
    .in("modelo_id", modelIds)
    .order("ordem", { ascending: true });

  if (groupsResult.error) {
    if (isMissingRelationError(groupsResult.error, "checklist_grupos")) {
      return null;
    }

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
    if (isMissingRelationError(itemsResult.error, "checklist_itens_modelo")) {
      return null;
    }

    throw itemsResult.error;
  }

  const responsesResult = companyId
    ? await supabase
        .from("empresa_checklist_respostas")
        .select("checklist_item_id, status, observacoes, updated_at")
        .eq("empresa_id", companyId)
        .order("updated_at", { ascending: false })
    : { data: null, error: null };

  if (responsesResult.error) {
    if (isMissingRelationError(responsesResult.error, "empresa_checklist_respostas")) {
      return null;
    }

    throw responsesResult.error;
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
    source: "normalized" as const,
    models,
    groupsByModel,
    responses: buildResponsesMap(responsesResult.data as ChecklistResponseRow[] | null),
    responseTable: "empresa_checklist_respostas" as const,
  };
};

const loadLegacyChecklistData = async (
  supabase: AppSupabaseClient,
  companyId?: string,
): Promise<LoadedChecklistData> => {
  const inspectionsResult = await supabase
    .from("inspecoes")
    .select("id, codigo, nome, tipo, ordem")
    .eq("tipo", "renovacao")
    .order("ordem", { ascending: true });

  if (inspectionsResult.error) {
    throw inspectionsResult.error;
  }

  const models = (inspectionsResult.data || []).map((inspection) => ({
    id: inspection.id,
    codigo: inspection.codigo,
    nome: inspection.nome,
    tipo: inspection.tipo,
    ordem: inspection.ordem,
    titulo: inspection.nome,
  }));

  const inspectionIds = models.map((model) => model.id);
  const itemsResult = inspectionIds.length
    ? await supabase
        .from("checklist_itens")
        .select("id, inspecao_id, item_numero, descricao, ordem")
        .in("inspecao_id", inspectionIds)
        .order("inspecao_id", { ascending: true })
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const responsesResult = companyId
    ? await supabase
        .from("empresa_checklist")
        .select("checklist_item_id, status, observacoes, updated_at")
        .eq("empresa_id", companyId)
        .order("updated_at", { ascending: false })
    : { data: null, error: null };

  if (responsesResult.error) {
    throw responsesResult.error;
  }

  const itemsByInspection = new Map<string, LegacyChecklistItemShape[]>();
  (itemsResult.data || []).forEach((item) => {
    const current = itemsByInspection.get(item.inspecao_id) || [];
    current.push(item);
    itemsByInspection.set(item.inspecao_id, current);
  });

  const { rowsByInspection } = buildLegacyChecklistRows(itemsByInspection);
  const groupsByModel = new Map<string, ChecklistGroupWithItems[]>();

  models.forEach((model) => {
    const rows = rowsByInspection.get(model.id) || [];
    const groups: ChecklistGroupWithItems[] = [];
    let currentGroup: ChecklistGroupWithItems | null = null;

    rows.forEach((row) => {
      if (row.type === "section") {
        currentGroup = {
          id: `legacy-group-${model.id}-${groups.length + 1}`,
          modelId: model.id,
          title: row.title,
          type: row.title.toLowerCase() === "outros" ? "outros" : "grupo",
          order: groups.length + 1,
          items: [],
        };
        groups.push(currentGroup);
        return;
      }

      if (!currentGroup) {
        currentGroup = {
          id: `legacy-group-${model.id}-1`,
          modelId: model.id,
          title: "Itens para avaliacao",
          type: "grupo",
          order: 1,
          items: [],
        };
        groups.push(currentGroup);
      }

      currentGroup.items.push({
        id: row.itemId,
        groupId: currentGroup.id,
        originalNumber: row.sourceItemNumber,
        description: row.description,
        complement: null,
        kind: "item",
        evaluable: true,
        order: currentGroup.items.length + 1,
      });
    });

    groupsByModel.set(model.id, groups);
  });

  return {
    source: "legacy",
    models,
    groupsByModel,
    responses: buildResponsesMap(responsesResult.data as ChecklistResponseRow[] | null),
    responseTable: "empresa_checklist",
  };
};

export const loadChecklistData = async (
  supabase: AppSupabaseClient,
  companyId?: string,
): Promise<LoadedChecklistData> => {
  const normalized = await loadNormalizedChecklistData(supabase, companyId);
  if (normalized) {
    return normalized;
  }

  return loadLegacyChecklistData(supabase, companyId);
};

export const saveChecklistResponses = async ({
  supabase,
  companyId,
  responseTable,
  responses,
  evaluableIds,
}: {
  supabase: AppSupabaseClient;
  companyId: string;
  responseTable: ChecklistResponseTable;
  responses: Map<string, ChecklistResponseShape>;
  evaluableIds: Set<string>;
}) => {
  if (responseTable === "empresa_checklist_respostas") {
    const { error: deleteError } = await supabase
      .from("empresa_checklist_respostas")
      .delete()
      .eq("empresa_id", companyId);

    if (deleteError) {
      throw deleteError;
    }

    const payload = Array.from(responses.values())
      .filter((response) => evaluableIds.has(response.checklist_item_id))
      .map((response) => ({
        empresa_id: companyId,
        checklist_item_id: response.checklist_item_id,
        status: response.status,
        observacoes: response.observacoes,
      }));

    if (payload.length > 0) {
      const { error: insertError } = await supabase
        .from("empresa_checklist_respostas")
        .insert(payload);

      if (insertError) {
        throw insertError;
      }
    }

    return;
  }

  const { error: legacyDeleteError } = await supabase
    .from("empresa_checklist")
    .delete()
    .eq("empresa_id", companyId);

  if (legacyDeleteError) {
    throw legacyDeleteError;
  }

  const legacyPayload = Array.from(responses.values())
    .filter((response) => evaluableIds.has(response.checklist_item_id))
    .map((response) => ({
      empresa_id: companyId,
      checklist_item_id: response.checklist_item_id,
      status: response.status,
      observacoes: response.observacoes,
    }));

  if (legacyPayload.length > 0) {
    const { error: legacyInsertError } = await supabase
      .from("empresa_checklist")
      .insert(legacyPayload);

    if (legacyInsertError) {
      throw legacyInsertError;
    }
  }
};
