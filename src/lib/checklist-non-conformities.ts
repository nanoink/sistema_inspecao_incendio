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

const LIGHTWEIGHT_NON_CONFORMITY_COLUMNS =
  "id, context_key, empresa_id, checklist_item_id, equipment_type, equipment_record_id, descricao, created_at, updated_at";

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
  options?: {
    includeImageData?: boolean;
  },
) => {
  const includeImageData = options?.includeImageData ?? true;
  let query = supabase
    .from("empresa_checklist_nao_conformidades")
    .select(
      includeImageData ? "*" : LIGHTWEIGHT_NON_CONFORMITY_COLUMNS,
    )
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

  return ((data || []) as ChecklistNonConformityRecord[]).map((record) =>
    includeImageData
      ? record
      : ({
          ...record,
          imagem_data_url: null,
        } satisfies ChecklistNonConformityRecord),
  );
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

export const loadEquipmentQrNonConformities = async (
  supabase: AppSupabaseClient,
  { token }: { token: string },
) => {
  const { data, error } = await supabase.rpc(
    "get_equipment_qr_non_conformities",
    {
      p_token: token,
    },
  );

  if (error) {
    throw error;
  }

  return (data || []) as ChecklistNonConformityRecord[];
};

export const saveEquipmentQrNonConformity = async (
  supabase: AppSupabaseClient,
  {
    token,
    checklistItemId,
    description,
    imageDataUrl,
  }: {
    token: string;
    checklistItemId: string;
    description: string;
    imageDataUrl?: string | null;
  },
) => {
  const { data, error } = await supabase.rpc(
    "save_equipment_qr_non_conformity",
    {
      p_token: token,
      p_checklist_item_id: checklistItemId,
      p_descricao: description.trim(),
      p_imagem_data_url: imageDataUrl?.trim() || null,
    },
  );

  if (error) {
    throw error;
  }

  return (data?.[0] || null) as ChecklistNonConformityRecord | null;
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
    .select(
      "id, context_key, empresa_id, checklist_item_id, equipment_type, equipment_record_id, descricao, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? ({
        ...data,
        imagem_data_url: payload.imagem_data_url,
      } satisfies ChecklistNonConformityRecord)
    : null;
};
