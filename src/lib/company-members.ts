import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type AppSupabaseClient = SupabaseClient<Database>;

export type CompanyMemberRole = "gestor" | "membro";

export type CompanyMemberSummary =
  Database["public"]["Functions"]["list_empresa_usuarios"]["Returns"][number];

export interface ChecklistExecutionSummary {
  inspection_code: string;
  inspection_name: string;
  context_type: "principal" | "equipamento";
  equipment_type: "extintor" | "hidrante" | "luminaria" | null;
  equipment_record_id: string | null;
  source_label: string | null;
  first_activity_at: string | null;
  last_activity_at: string | null;
  total_saves: number;
}

export interface CompanyReportSignatureRow
  extends Omit<
    Database["public"]["Functions"]["get_empresa_relatorio_assinaturas"]["Returns"][number],
    "executed_checklists"
  > {
  executed_checklists: ChecklistExecutionSummary[];
}

export interface CreatedCompanyUserSummary {
  user_id: string;
  nome: string;
  email: string;
  papel: CompanyMemberRole;
  temporary_password: boolean;
}

const isObject = (value: Json | null | undefined): value is Record<string, Json> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const parseChecklistExecutionSummary = (
  value: Json,
): ChecklistExecutionSummary | null => {
  if (!isObject(value)) {
    return null;
  }

  const inspectionCode =
    typeof value.inspection_code === "string" ? value.inspection_code : "";
  const inspectionName =
    typeof value.inspection_name === "string" ? value.inspection_name : "";
  const contextType =
    value.context_type === "principal" || value.context_type === "equipamento"
      ? value.context_type
      : null;
  const totalSaves =
    typeof value.total_saves === "number" ? value.total_saves : 0;

  if (!inspectionCode || !inspectionName || !contextType) {
    return null;
  }

  return {
    inspection_code: inspectionCode,
    inspection_name: inspectionName,
    context_type: contextType,
    equipment_type:
      value.equipment_type === "extintor" ||
      value.equipment_type === "hidrante" ||
      value.equipment_type === "luminaria"
        ? value.equipment_type
        : null,
    equipment_record_id:
      typeof value.equipment_record_id === "string"
        ? value.equipment_record_id
        : null,
    source_label:
      typeof value.source_label === "string" ? value.source_label : null,
    first_activity_at:
      typeof value.first_activity_at === "string" ? value.first_activity_at : null,
    last_activity_at:
      typeof value.last_activity_at === "string" ? value.last_activity_at : null,
    total_saves: totalSaves,
  };
};

const parseChecklistExecutionSummaries = (value: Json): ChecklistExecutionSummary[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => parseChecklistExecutionSummary(entry))
    .filter((entry): entry is ChecklistExecutionSummary => !!entry);
};

export const loadCompanyMembers = async (
  supabase: AppSupabaseClient,
  companyId: string,
) => {
  const { data, error } = await supabase.rpc("list_empresa_usuarios", {
    p_empresa_id: companyId,
  });

  if (error) {
    throw error;
  }

  return (data || []) as CompanyMemberSummary[];
};

export const addCompanyMemberByEmail = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    email,
    role,
  }: {
    companyId: string;
    email: string;
    role?: CompanyMemberRole;
  },
) => {
  const { data, error } = await supabase.rpc("add_empresa_usuario_by_email", {
    p_empresa_id: companyId,
    p_email: email.trim().toLowerCase(),
    p_papel: role || "membro",
  });

  if (error) {
    throw error;
  }

  return ((data || [])[0] || null) as CompanyMemberSummary | null;
};

export const createCompanyUser = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    nome,
    email,
    password,
    role,
  }: {
    companyId: string;
    nome: string;
    email: string;
    password: string;
    role?: CompanyMemberRole;
  },
) => {
  const { data, error } = await supabase.functions.invoke("create-company-user", {
    body: {
      companyId,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || "membro",
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const errorPayload = await error.context.json().catch(() => null);
      throw new Error(
        typeof errorPayload?.error === "string"
          ? errorPayload.error
          : "Nao foi possivel criar o usuario da empresa.",
      );
    }

    if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
      throw new Error(
        "Nao foi possivel comunicar com o servico de criacao de usuarios.",
      );
    }

    throw error;
  }

  return (data || null) as CreatedCompanyUserSummary | null;
};

export const setCompanyMemberRole = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    userId,
    role,
  }: {
    companyId: string;
    userId: string;
    role: CompanyMemberRole;
  },
) => {
  const { data, error } = await supabase.rpc("set_empresa_usuario_role", {
    p_empresa_id: companyId,
    p_user_id: userId,
    p_papel: role,
  });

  if (error) {
    throw error;
  }

  return ((data || [])[0] || null) as CompanyMemberSummary | null;
};

export const removeCompanyMember = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    userId,
  }: {
    companyId: string;
    userId: string;
  },
) => {
  const { error } = await supabase.rpc("remove_empresa_usuario", {
    p_empresa_id: companyId,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }
};

export const registerChecklistExecution = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    inspectionCode,
    inspectionName,
    contextType,
    equipmentType,
    equipmentRecordId,
    sourceLabel,
  }: {
    companyId: string;
    inspectionCode: string;
    inspectionName: string;
    contextType: "principal" | "equipamento";
    equipmentType?: "extintor" | "hidrante" | "luminaria" | null;
    equipmentRecordId?: string | null;
    sourceLabel?: string | null;
  },
) => {
  const { data, error } = await supabase.rpc("register_checklist_execution", {
    p_empresa_id: companyId,
    p_inspection_code: inspectionCode,
    p_inspection_name: inspectionName,
    p_context_type: contextType,
    p_equipment_type: equipmentType ?? null,
    p_equipment_record_id: equipmentRecordId ?? null,
    p_source_label: sourceLabel ?? null,
  });

  if (error) {
    throw error;
  }

  return (
    (data || [])[0] || null
  ) as Database["public"]["Functions"]["register_checklist_execution"]["Returns"][number] | null;
};

export const loadCompanyReportSignatures = async (
  supabase: AppSupabaseClient,
  companyId: string,
) => {
  const { data, error } = await supabase.rpc("get_empresa_relatorio_assinaturas", {
    p_empresa_id: companyId,
  });

  if (error) {
    throw error;
  }

  return ((data || []) as Database["public"]["Functions"]["get_empresa_relatorio_assinaturas"]["Returns"]).map(
    (row) => ({
      ...row,
      executed_checklists: parseChecklistExecutionSummaries(row.executed_checklists),
    }),
  );
};

export const parseCompanyReportSignatures = (value: Json | null | undefined) => {
  if (!Array.isArray(value)) {
    return [] as CompanyReportSignatureRow[];
  }

  return value.flatMap((entry) => {
    if (!isObject(entry)) {
      return [];
    }

    const userId = typeof entry.user_id === "string" ? entry.user_id : "";
    const nome = typeof entry.nome === "string" ? entry.nome : "";
    const email = typeof entry.email === "string" ? entry.email : "";
    const papel = typeof entry.papel === "string" ? entry.papel : "";
    const assinaturaNome =
      typeof entry.assinatura_nome === "string" ? entry.assinatura_nome : "";
    const isGestor = typeof entry.is_gestor === "boolean" ? entry.is_gestor : false;
    const totalChecklists =
      typeof entry.total_checklists === "number" ? entry.total_checklists : 0;

    if (!userId || !nome || !email || !papel || !assinaturaNome) {
      return [];
    }

    return [
      {
        user_id: userId,
        nome,
        email,
        papel,
        is_gestor: isGestor,
        assinatura_nome: assinaturaNome,
        executed_checklists: parseChecklistExecutionSummaries(
          entry.executed_checklists as Json,
        ),
        first_activity_at:
          typeof entry.first_activity_at === "string" ? entry.first_activity_at : null,
        last_activity_at:
          typeof entry.last_activity_at === "string" ? entry.last_activity_at : null,
        total_checklists: totalChecklists,
      },
    ];
  });
};
