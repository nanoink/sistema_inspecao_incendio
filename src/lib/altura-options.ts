import { supabase } from "@/integrations/supabase/client";

export interface AlturaOption {
  tipo: string;
  denominacao: string;
  h_min_m: number | null;
  h_max_m: number | null;
}

const FALLBACK_ALTURA_OPTIONS: AlturaOption[] = [
  {
    tipo: "I",
    denominacao: "Edificação Térrea",
    h_min_m: null,
    h_max_m: null,
  },
  {
    tipo: "II",
    denominacao: "Edificação de Baixa Altura",
    h_min_m: null,
    h_max_m: 6,
  },
  {
    tipo: "III",
    denominacao: "Edificação de Baixa-Média Altura",
    h_min_m: 6,
    h_max_m: 12,
  },
  {
    tipo: "IV",
    denominacao: "Edificação de Média Altura",
    h_min_m: 12,
    h_max_m: 30,
  },
  {
    tipo: "V",
    denominacao: "Edificação de Grande Altura",
    h_min_m: 30,
    h_max_m: null,
  },
];

let alturaOptionsCache: AlturaOption[] | null = null;
let alturaOptionsRequest: Promise<AlturaOption[]> | null = null;

export const getFallbackAlturaOptions = (): AlturaOption[] =>
  FALLBACK_ALTURA_OPTIONS.map((option) => ({ ...option }));

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeComparableText = (value: unknown) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

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
    const comparableTipo = normalizeComparableText(tipo);

    // Radix Select throws when an item value is empty; duplicates also create unstable UI.
    if (!tipo || !denominacao || seenTipos.has(comparableTipo)) {
      return [];
    }

    seenTipos.add(comparableTipo);

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
  if (alturaOptionsCache) {
    return alturaOptionsCache.map((option) => ({ ...option }));
  }

  if (!alturaOptionsRequest) {
    alturaOptionsRequest = (async () => {
      const { data, error } = await supabase
        .from("altura_ref")
        .select("tipo, denominacao, h_min_m, h_max_m")
        .order("tipo");

      if (error) {
        throw error;
      }

      const options = sanitizeAlturaOptions(data ?? []);

      if (options.length === 0) {
        throw new Error("O catálogo de alturas retornou vazio ou inválido.");
      }

      alturaOptionsCache = options;
      return options;
    })().finally(() => {
      alturaOptionsRequest = null;
    });
  }

  const options = await alturaOptionsRequest;
  return options.map((option) => ({ ...option }));
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

const findAlturaOptionByText = (
  options: AlturaOption[],
  values: Array<string | null | undefined>,
) => {
  const normalizedValues = values
    .map((value) => normalizeComparableText(value))
    .filter(Boolean);

  if (normalizedValues.length === 0) {
    return null;
  }

  return (
    options.find((option) => {
      const normalizedCandidates = [
        option.tipo,
        option.denominacao,
        describeAlturaOption(option),
        `${option.tipo} - ${option.denominacao}`,
        `${option.tipo} — ${option.denominacao}`,
      ].map((candidate) => normalizeComparableText(candidate));

      return normalizedValues.some((value) =>
        normalizedCandidates.some((candidate) => candidate === value),
      );
    }) ?? null
  );
};

const findAlturaOptionByRealHeight = (
  options: AlturaOption[],
  alturaRealM: unknown,
) => {
  const normalizedHeight = normalizeNullableNumber(alturaRealM);

  if (normalizedHeight === null) {
    return null;
  }

  return (
    options.find((option) => {
      if (option.h_min_m === null && option.h_max_m === null) {
        return false;
      }

      if (option.h_min_m === null && option.h_max_m !== null) {
        return normalizedHeight <= option.h_max_m;
      }

      if (option.h_min_m !== null && option.h_max_m === null) {
        return normalizedHeight > option.h_min_m;
      }

      if (option.h_min_m !== null && option.h_max_m !== null) {
        return (
          normalizedHeight > option.h_min_m &&
          normalizedHeight <= option.h_max_m
        );
      }

      return false;
    }) ?? null
  );
};

export const getSafeAlturaSelectValue = (
  tipo: string | null | undefined,
  options: AlturaOption[],
) => {
  const normalizedTipo = normalizeText(tipo);

  if (!normalizedTipo) {
    return "";
  }

  // Preserve the form value while the async catalog is still loading.
  if (options.length === 0) {
    return normalizedTipo;
  }

  return findAlturaOption(options, normalizedTipo)?.tipo ?? "";
};

export const getAlturaSelectionState = (
  tipo: string | null | undefined,
  options: AlturaOption[],
) => {
  const normalizedTipo = normalizeText(tipo);
  const selected = findAlturaOption(options, tipo);

  if (!selected) {
    return {
      tipo: normalizedTipo,
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

export const getStoredAlturaSelectionState = (
  values: {
    tipo?: string | null;
    denominacao?: string | null;
    descricao?: string | null;
    alturaRealM?: number | string | null;
  },
  options: AlturaOption[],
) => {
  const directSelection = getAlturaSelectionState(values.tipo, options);

  if (directSelection.tipo && directSelection.denominacao) {
    return directSelection;
  }

  const matchedByText = findAlturaOptionByText(options, [
    values.tipo,
    values.denominacao,
    values.descricao,
  ]);
  const matchedByHeight =
    matchedByText ?? findAlturaOptionByRealHeight(options, values.alturaRealM);

  if (matchedByHeight) {
    return getAlturaSelectionState(matchedByHeight.tipo, options);
  }

  return {
    tipo: directSelection.tipo,
    denominacao: normalizeText(values.denominacao),
    descricao: normalizeText(values.descricao),
  };
};
