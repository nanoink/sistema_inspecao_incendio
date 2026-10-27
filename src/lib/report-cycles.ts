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
    attachmentChange?: { add: Json } | { removeId: string };
  },
) => {
  const cycleResolver = options?.editableCycle
    ? resolveEditableReportCycleId
    : resolveActiveReportCycleId;
  const resolvedCycleId = await cycleResolver(supabase, companyId);
  const select = options?.select || "*";
  let legacySchema = false;

  // A checklist save is only a patch: it must never replace the report's JSON
  // with { report_cycle_id }. Re-read and compare updated_at so another tab's
  // attachments/ART cannot be overwritten between the read and the write.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let currentQuery = supabase
      .from("empresa_relatorios")
      .select("id, updated_at, dados_adicionais")
      .eq("empresa_id", companyId);
    if (resolvedCycleId && !legacySchema) {
      currentQuery = currentQuery.eq("relatorio_ciclo_id", resolvedCycleId);
    }
    const currentResult = await currentQuery.maybeSingle();
    if (currentResult.error) {
      if (!legacySchema && isMissingColumnError(currentResult.error, ["relatorio_ciclo_id"])) {
        legacySchema = true;
        continue;
      }
      throw currentResult.error;
    }

    const current = currentResult.data;
    const additionalData: Record<string, Json> = {
      ...(isObjectRecord(current?.dados_adicionais) ? current.dados_adicionais : {}),
      ...(isObjectRecord(payload.dados_adicionais) ? payload.dados_adicionais : {}),
      ...(resolvedCycleId ? { report_cycle_id: resolvedCycleId } : {}),
    };
    if (options?.attachmentChange) {
      const stored = Array.isArray(additionalData.report_attachments)
        ? additionalData.report_attachments : [];
      const change = options.attachmentChange;
      additionalData.report_attachments = "add" in change
        ? [...stored.filter((entry) => !isObjectRecord(entry) ||
            !isObjectRecord(change.add) || entry.id !== change.add.id), change.add]
        : stored.filter((entry) => !isObjectRecord(entry) || entry.id !== change.removeId);
    }
    const nextPayload: ReportInsert = {
      ...payload,
      empresa_id: companyId,
      ...(!legacySchema && resolvedCycleId ? { relatorio_ciclo_id: resolvedCycleId } : {}),
      dados_adicionais: additionalData,
    };
    const result = current
      ? await supabase.from("empresa_relatorios")
          .update(nextPayload)
          .eq("id", current.id)
          .eq("updated_at", current.updated_at)
          .select(select).maybeSingle()
      : await supabase.from("empresa_relatorios")
          .insert(nextPayload).select(select).single();

    if (result.error) {
      if (!legacySchema && isMissingColumnError(result.error, ["relatorio_ciclo_id"])) {
        legacySchema = true;
        continue;
      }
      if (!current && result.error.code === "23505") continue;
      throw result.error;
    }
    if (result.data) {
      return { activeReportCycleId: resolvedCycleId, report: result.data as ReportRow };
    }
    // A concurrent update changed updated_at. Merge with the new version.
  }
  throw new Error("O relatorio foi alterado em outra sessao. Tente salvar novamente.");
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
