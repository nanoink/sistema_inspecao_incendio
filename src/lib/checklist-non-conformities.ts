import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Tables,
  TablesInsert,
} from "@/integrations/supabase/types";

type AppSupabaseClient = SupabaseClient<Database>;

export type NonConformityEquipmentType =
  | "extintor"
  | "hidrante"
  | "luminaria";
export type ChecklistNonConformityRecord =
  Tables<"empresa_checklist_nao_conformidades">;
type ChecklistNonConformityPayload =
  TablesInsert<"empresa_checklist_nao_conformidades">;

interface BaseScope {
  companyId: string;
}

interface PrincipalScope extends BaseScope {
  checklistItemId?: string;
  equipmentType?: null;
  equipmentRecordId?: null;
}

interface EquipmentScope extends BaseScope {
  checklistItemId?: string;
  equipmentType: NonConformityEquipmentType;
  equipmentRecordId: string;
}

type ChecklistNonConformityScope = PrincipalScope | EquipmentScope;

export const groupChecklistNonConformitiesByEquipmentRecordId = (
  records: ChecklistNonConformityRecord[],
) => {
  const grouped = new Map<string, Map<string, ChecklistNonConformityRecord>>();

  records.forEach((record) => {
    if (!record.equipment_record_id) {
      return;
    }

    const current = grouped.get(record.equipment_record_id) || new Map();
    current.set(record.checklist_item_id, record);
    grouped.set(record.equipment_record_id, current);
  });

  return grouped;
};

const isEquipmentScope = (
  scope: ChecklistNonConformityScope,
): scope is EquipmentScope =>
  !!scope.equipmentType && !!scope.equipmentRecordId;

export const buildChecklistNonConformityContextKey = ({
  companyId,
  checklistItemId,
  equipmentType,
  equipmentRecordId,
}: {
  companyId: string;
  checklistItemId: string;
  equipmentType?: NonConformityEquipmentType | null;
  equipmentRecordId?: string | null;
}) =>
  equipmentType && equipmentRecordId
    ? `${companyId}:${equipmentType}:${equipmentRecordId}:${checklistItemId}`
    : `${companyId}:principal:${checklistItemId}`;

export const mapChecklistNonConformitiesByItemId = (
  records: ChecklistNonConformityRecord[],
) =>
  new Map(records.map((record) => [record.checklist_item_id, record]));

export const loadChecklistNonConformities = async (
  supabase: AppSupabaseClient,
  scope: ChecklistNonConformityScope,
) => {
  let query = supabase
    .from("empresa_checklist_nao_conformidades")
    .select("*")
    .eq("empresa_id", scope.companyId)
    .order("updated_at", { ascending: false });

  if (scope.checklistItemId) {
    query = query.eq("checklist_item_id", scope.checklistItemId);
  }

  if (isEquipmentScope(scope)) {
    query = query
      .eq("equipment_type", scope.equipmentType)
      .eq("equipment_record_id", scope.equipmentRecordId);
  } else {
    query = query.is("equipment_type", null).is("equipment_record_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
};

export const loadEquipmentChecklistNonConformitiesByType = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    equipmentType,
  }: {
    companyId: string;
    equipmentType: NonConformityEquipmentType;
  },
) => {
  const { data, error } = await supabase
    .from("empresa_checklist_nao_conformidades")
    .select("*")
    .eq("empresa_id", companyId)
    .eq("equipment_type", equipmentType)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

export const saveChecklistNonConformity = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    checklistItemId,
    description,
    imageDataUrl,
    equipmentType,
    equipmentRecordId,
  }: {
    companyId: string;
    checklistItemId: string;
    description: string;
    imageDataUrl?: string | null;
    equipmentType?: NonConformityEquipmentType | null;
    equipmentRecordId?: string | null;
  },
) => {
  const payload: ChecklistNonConformityPayload = {
    context_key: buildChecklistNonConformityContextKey({
      companyId,
      checklistItemId,
      equipmentType,
      equipmentRecordId,
    }),
    empresa_id: companyId,
    checklist_item_id: checklistItemId,
    equipment_type: equipmentType ?? null,
    equipment_record_id: equipmentRecordId ?? null,
    descricao: description.trim(),
    imagem_data_url: imageDataUrl?.trim() || null,
  };

  const { data, error } = await supabase
    .from("empresa_checklist_nao_conformidades")
    .upsert(payload, { onConflict: "context_key" })
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};
