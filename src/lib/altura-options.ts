import { supabase } from "@/integrations/supabase/client";

export interface AlturaOption {
  tipo: string;
  denominacao: string;
  h_min_m: number | null;
  h_max_m: number | null;
}

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const sanitizeAlturaOptions = (rows: unknown[]): AlturaOption[] => {
  const seenTipos = new Set<string>();

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const candidate = row as Record<string, unknown>;
    const tipo = normalizeText(candidate.tipo);
    const denominacao = normalizeText(candidate.denominacao);

    // Radix Select throws when an item value is empty; duplicates also create unstable UI.
    if (!tipo || !denominacao || seenTipos.has(tipo)) {
      return [];
    }

    seenTipos.add(tipo);

    return [
      {
        tipo,
        denominacao,
        h_min_m: normalizeNullableNumber(candidate.h_min_m),
        h_max_m: normalizeNullableNumber(candidate.h_max_m),
      },
    ];
  });
};

export const fetchAlturaOptions = async (): Promise<AlturaOption[]> => {
  const { data, error } = await supabase
    .from("altura_ref")
    .select("tipo, denominacao, h_min_m, h_max_m")
    .order("tipo");

  if (error) {
    throw error;
  }

  return sanitizeAlturaOptions(data ?? []);
};

export const describeAlturaOption = (
  option: Pick<AlturaOption, "h_min_m" | "h_max_m">,
) => {
  if (option.h_min_m === null && option.h_max_m === null) {
    return "Um pavimento";
  }

  if (option.h_min_m === null && option.h_max_m !== null) {
    return `H < ${option.h_max_m} m`;
  }

  if (option.h_min_m !== null && option.h_max_m === null) {
    return `Acima de ${option.h_min_m} m`;
  }

  if (option.h_min_m !== null && option.h_max_m !== null) {
    return `${option.h_min_m} < H < ${option.h_max_m} m`;
  }

  return "";
};

export const findAlturaOption = (
  options: AlturaOption[],
  tipo: string | null | undefined,
) => {
  const normalizedTipo = normalizeText(tipo);

  if (!normalizedTipo) {
    return null;
  }

  return options.find((option) => option.tipo === normalizedTipo) ?? null;
};

export const getSafeAlturaSelectValue = (
  tipo: string | null | undefined,
  options: AlturaOption[],
) => findAlturaOption(options, tipo)?.tipo ?? "";

export const getAlturaSelectionState = (
  tipo: string | null | undefined,
  options: AlturaOption[],
) => {
  const selected = findAlturaOption(options, tipo);

  if (!selected) {
    return {
      tipo: "",
      denominacao: "",
      descricao: "",
    };
  }

  return {
    tipo: selected.tipo,
    denominacao: selected.denominacao,
    descricao: describeAlturaOption(selected),
  };
};
