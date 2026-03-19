import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type ChecklistGroupWithItems,
  type ChecklistItemShape,
  type ChecklistModelShape,
  type ChecklistResponseShape,
} from "@/lib/checklist";

type AppSupabaseClient = SupabaseClient<Database>;

interface ChecklistResponseRow {
  checklist_item_id: string;
  status: string;
  observacoes: string | null;
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

  const responsesResult = await supabase
    .from("empresa_checklist_respostas")
    .select("checklist_item_id, status, observacoes, updated_at")
    .eq("empresa_id", companyId)
    .order("updated_at", { ascending: false });

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
};
