import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  isMissingColumnError,
  isMissingFunctionError,
  isMissingRelationError,
} from "@/lib/supabase-errors";

type AppSupabaseClient = SupabaseClient<Database>;
type ReportRow = Database["public"]["Tables"]["empresa_relatorios"]["Row"];
type ReportInsert = Database["public"]["Tables"]["empresa_relatorios"]["Insert"];

const activeReportCyclePromiseCache = new Map<string, Promise<string | null>>();
const editableReportCyclePromiseCache = new Map<string, Promise<string | null>>();

const isObjectRecord = (value: Json | null | undefined): value is Record<string, Json> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const clearActiveReportCycleCache = (companyId?: string) => {
  if (companyId) {
    activeReportCyclePromiseCache.delete(companyId);
    editableReportCyclePromiseCache.delete(companyId);
    return;
  }

  activeReportCyclePromiseCache.clear();
  editableReportCyclePromiseCache.clear();
};

export const resolveActiveReportCycleId = async (
  supabase: AppSupabaseClient,
  companyId?: string,
) => {
  if (!companyId) {
    return null;
  }

  const cachedPromise = activeReportCyclePromiseCache.get(companyId);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = (async () => {
    const { data, error } = await supabase.rpc("get_or_create_active_report_cycle", {
      p_empresa_id: companyId,
    });

    if (error) {
      if (isMissingFunctionError(error, "get_or_create_active_report_cycle")) {
        return null;
      }

      throw error;
    }

    return ((data || [])[0] || null)?.id ?? null;
  })();

  activeReportCyclePromiseCache.set(companyId, promise);

  try {
    return await promise;
  } catch (error) {
    activeReportCyclePromiseCache.delete(companyId);
    throw error;
  }
};

export const resolveEditableReportCycleId = async (
  supabase: AppSupabaseClient,
  companyId?: string,
) => {
  if (!companyId) {
    return null;
  }

  const cachedPromise = editableReportCyclePromiseCache.get(companyId);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = (async () => {
    const { data, error } = await supabase.rpc("get_or_create_editable_report_cycle", {
      p_empresa_id: companyId,
    });

    if (error) {
      if (isMissingFunctionError(error, "get_or_create_editable_report_cycle")) {
        return resolveActiveReportCycleId(supabase, companyId);
      }

      throw error;
    }

    return ((data || [])[0] || null)?.id ?? null;
  })();

  editableReportCyclePromiseCache.set(companyId, promise);

  try {
    const resolved = await promise;
    if (resolved) {
      activeReportCyclePromiseCache.set(companyId, Promise.resolve(resolved));
    }
    return resolved;
  } catch (error) {
    editableReportCyclePromiseCache.delete(companyId);
    throw error;
  }
};

export const loadActiveCompanyReport = async (
  supabase: AppSupabaseClient,
  companyId: string,
  select = "*",
) => {
  const activeReportCycleId = await resolveActiveReportCycleId(supabase, companyId);

  let query = supabase
    .from("empresa_relatorios")
    .select(select)
    .eq("empresa_id", companyId);

  if (activeReportCycleId) {
    query = query.eq("relatorio_ciclo_id", activeReportCycleId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (isMissingRelationError(error, "empresa_relatorios")) {
      return {
        activeReportCycleId,
        report: null,
      };
    }

    if (isMissingColumnError(error, ["relatorio_ciclo_id"])) {
      const fallbackResult = await supabase
        .from("empresa_relatorios")
        .select(select)
        .eq("empresa_id", companyId)
        .maybeSingle();

      if (fallbackResult.error) {
        throw fallbackResult.error;
      }

      return {
        activeReportCycleId,
        report: fallbackResult.data,
      };
    }

    throw error;
  }

  return {
    activeReportCycleId,
    report: data,
  };
};

export const upsertCompanyReportForCycle = async (
  supabase: AppSupabaseClient,
  companyId: string,
  payload: Omit<ReportInsert, "empresa_id" | "relatorio_ciclo_id">,
  options?: {
    editableCycle?: boolean;
    select?: string;
  },
) => {
  const cycleResolver = options?.editableCycle
    ? resolveEditableReportCycleId
    : resolveActiveReportCycleId;
  const resolvedCycleId = await cycleResolver(supabase, companyId);
  const nextAdditionalData = isObjectRecord(payload.dados_adicionais)
    ? {
        ...payload.dados_adicionais,
        report_cycle_id: resolvedCycleId,
      }
    : resolvedCycleId
      ? ({ report_cycle_id: resolvedCycleId } satisfies Record<string, Json>)
      : payload.dados_adicionais;

  const nextPayload: ReportInsert = {
    ...payload,
    empresa_id: companyId,
    relatorio_ciclo_id: resolvedCycleId ?? undefined,
    dados_adicionais: nextAdditionalData,
  };

  const select = options?.select || "*";
  const { data, error } = await supabase
    .from("empresa_relatorios")
    .upsert(nextPayload, { onConflict: "empresa_id,relatorio_ciclo_id" })
    .select(select)
    .single();

  if (error) {
    if (isMissingColumnError(error, ["relatorio_ciclo_id"])) {
      const legacyPayload = {
        ...payload,
        empresa_id: companyId,
      };

      const fallbackResult = await supabase
        .from("empresa_relatorios")
        .upsert(legacyPayload, { onConflict: "empresa_id" })
        .select(select)
        .single();

      if (fallbackResult.error) {
        throw fallbackResult.error;
      }

      return {
        activeReportCycleId: resolvedCycleId,
        report: fallbackResult.data,
      };
    }

    throw error;
  }

  return {
    activeReportCycleId: resolvedCycleId,
    report: data as ReportRow,
  };
};

export const startNewCompanyReportCycle = async (
  supabase: AppSupabaseClient,
  companyId: string,
  cycleName?: string | null,
) => {
  const { data, error } = await supabase.rpc("start_new_report_cycle", {
    p_empresa_id: companyId,
    p_nome: cycleName ?? null,
  });

  if (error) {
    throw error;
  }

  clearActiveReportCycleCache(companyId);

  return ((data || [])[0] || null) as
    | Database["public"]["Functions"]["start_new_report_cycle"]["Returns"][number]
    | null;
};
