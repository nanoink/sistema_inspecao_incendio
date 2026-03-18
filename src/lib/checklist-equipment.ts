import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import { isMissingRelationError } from "@/lib/supabase-errors";

type AppSupabaseClient = SupabaseClient<Database>;

export type ExtinguisherRecord = Tables<"empresa_extintores">;
export type HydrantRecord = Tables<"empresa_hidrantes">;
export type ExtinguisherPayload = TablesInsert<"empresa_extintores">;
export type HydrantPayload = TablesInsert<"empresa_hidrantes">;
export type AutoChecklistStatus = "C" | "NC" | "NA";

export interface EquipmentRuleEvaluation {
  status?: AutoChecklistStatus;
  message: string;
}

export const EXTINGUISHER_TYPE_OPTIONS = [
  {
    value: "Agua Pressurizada",
    label: "Agua Pressurizada (AP)",
    loadOptions: ["10 L", "12 L"],
  },
  {
    value: "Espuma Mecanica",
    label: "Espuma Mecanica (LGE)",
    loadOptions: ["9 L", "10 L", "45 L"],
  },
  {
    value: "Po ABC",
    label: "Po Quimico Seco PQS - ABC",
    loadOptions: ["2 kg", "4 kg", "6 kg", "8 kg", "12 kg", "20 kg", "25 kg", "50 kg", "75 kg"],
  },
  {
    value: "Po BC",
    label: "Po Quimico Seco PQS - BC",
    loadOptions: ["2 kg", "4 kg", "6 kg", "8 kg", "12 kg", "20 kg", "25 kg", "50 kg", "75 kg"],
  },
  {
    value: "CO2",
    label: "Dioxido de Carbono (CO2)",
    loadOptions: ["2 kg", "4 kg", "6 kg", "10 kg", "25 kg", "50 kg"],
  },
  {
    value: "Classe K",
    label: "Classe K",
    loadOptions: ["6 L", "9 L"],
  },
  {
    value: "Halotron",
    label: "Halotron",
    loadOptions: ["2 kg", "4 kg", "6 kg"],
  },
] as const;

export const HYDRANT_TYPE_OPTIONS = [
  { value: "Hidrante de Parede", label: "Hidrante de Parede" },
  { value: "Hidrante Industrial", label: "Hidrante Industrial" },
] as const;

export const HOSE_TYPE_OPTIONS = [
  { value: "Tipo 1 - 15 m", label: "Mangueira Tipo 1 - 15 m" },
  { value: "Tipo 1 - 20 m", label: "Mangueira Tipo 1 - 20 m" },
  { value: "Tipo 1 - 25 m", label: "Mangueira Tipo 1 - 25 m" },
  { value: "Tipo 2 - 15 m", label: "Mangueira Tipo 2 - 15 m" },
  { value: "Tipo 2 - 20 m", label: "Mangueira Tipo 2 - 20 m" },
  { value: "Tipo 2 - 25 m", label: "Mangueira Tipo 2 - 25 m" },
  { value: "Tipo 2 - 30 m", label: "Mangueira Tipo 2 - 30 m" },
  { value: "Tipo 3 - 15 m", label: "Mangueira Tipo 3 - 15 m" },
  { value: "Tipo 3 - 20 m", label: "Mangueira Tipo 3 - 20 m" },
  { value: "Tipo 3 - 25 m", label: "Mangueira Tipo 3 - 25 m" },
  { value: "Tipo 3 - 30 m", label: "Mangueira Tipo 3 - 30 m" },
  { value: "Tipo 4 - 15 m", label: "Mangueira Tipo 4 - 15 m" },
  { value: "Tipo 4 - 20 m", label: "Mangueira Tipo 4 - 20 m" },
  { value: "Tipo 4 - 25 m", label: "Mangueira Tipo 4 - 25 m" },
  { value: "Tipo 4 - 30 m", label: "Mangueira Tipo 4 - 30 m" },
  { value: "Tipo 5 - 15 m", label: "Mangueira Tipo 5 - 15 m" },
  { value: "Tipo 5 - 20 m", label: "Mangueira Tipo 5 - 20 m" },
  { value: "Tipo 5 - 25 m", label: "Mangueira Tipo 5 - 25 m" },
  { value: "Tipo 5 - 30 m", label: "Mangueira Tipo 5 - 30 m" },
] as const;

export const YES_NO_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Nao" },
] as const;

const normalizeDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const toMonthInputValue = (value?: string | null) =>
  value ? value.slice(0, 7) : "";

export const monthInputToDateValue = (value: string) =>
  value ? `${value}-01` : null;

export const formatMonthYear = (value?: string | null) => {
  const date = normalizeDate(value);
  if (!date) {
    return "-";
  }

  return date.toLocaleDateString("pt-BR", {
    month: "2-digit",
    year: "numeric",
  });
};

export const sortByEquipmentNumber = <T extends { numero: string }>(
  records: T[],
) =>
  records
    .slice()
    .sort((left, right) =>
      left.numero.localeCompare(right.numero, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }),
    );

export const isDateExpired = (
  value?: string | null,
  referenceDate = new Date(),
) => {
  const date = normalizeDate(value);
  if (!date) {
    return false;
  }

  return date < new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
};

export const isHydroYearExpired = (
  year?: number | null,
  referenceDate = new Date(),
) => {
  if (!year) {
    return false;
  }

  return year < referenceDate.getFullYear();
};

export const buildExtinguisherSummary = (
  extinguishers: ExtinguisherRecord[],
  referenceDate = new Date(),
) => ({
  total: extinguishers.length,
  expiredRecharge: extinguishers.filter((item) =>
    isDateExpired(item.vencimento_carga, referenceDate),
  ).length,
  expiredHydroTest: extinguishers.filter((item) =>
    isHydroYearExpired(item.vencimento_teste_hidrostatico_ano, referenceDate),
  ).length,
});

export const buildHydrantSummary = (
  hydrants: HydrantRecord[],
  referenceDate = new Date(),
) => ({
  total: hydrants.length,
  expiredHoses: hydrants.filter(
    (item) =>
      isDateExpired(item.mangueira1_vencimento_teste_hidrostatico, referenceDate) ||
      isDateExpired(item.mangueira2_vencimento_teste_hidrostatico, referenceDate),
  ).length,
  missingComponents: hydrants.filter(
    (item) => !item.esguicho || !item.chave_mangueira,
  ).length,
});

export const isWheelExtinguisher = (item: ExtinguisherRecord) => {
  const load = item.carga_nominal.toLowerCase();
  return ["25 kg", "50 kg", "75 kg", "45 l"].includes(load);
};

const formatJoinedList = (values: string[]) => {
  const unique = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );

  if (unique.length === 0) {
    return null;
  }

  return unique.join(", ");
};

export const getExtinguisherRuleEvaluation = ({
  sectionTitle,
  itemNumber,
  extinguishers,
  referenceDate = new Date(),
}: {
  sectionTitle: string;
  itemNumber?: string | null;
  extinguishers: ExtinguisherRecord[];
  referenceDate?: Date;
}): EquipmentRuleEvaluation | null => {
  const total = extinguishers.length;
  if (total === 0) {
    return null;
  }

  const wheeledExtinguishers = extinguishers.filter(isWheelExtinguisher);
  const co2Extinguishers = extinguishers.filter((item) => item.tipo === "CO2");
  const expiredRecharge = extinguishers.filter((item) =>
    isDateExpired(item.vencimento_carga, referenceDate),
  );
  const distinctLocations = new Set(
    extinguishers.map((item) => item.localizacao.trim()).filter(Boolean),
  ).size;

  if (
    sectionTitle === "Localizacao e Fixacao dos aparelhos extintores" &&
    itemNumber === "1"
  ) {
    return {
      message: `${total} extintor(es) cadastrado(s) em ${distinctLocations} localizacao(oes). Conferir a distribuicao em planta.`,
    };
  }

  if (
    sectionTitle === "Localizacao e Fixacao dos aparelhos extintores" &&
    itemNumber === "2"
  ) {
    const types = formatJoinedList(extinguishers.map((item) => item.tipo));
    return types
      ? {
          message: `Tipos cadastrados: ${types}. Conferir se o agente extintor confere com o previsto em planta.`,
        }
      : null;
  }

  if (
    sectionTitle === "Localizacao e Fixacao dos aparelhos extintores" &&
    itemNumber === "3"
  ) {
    const loads = formatJoinedList(
      extinguishers.map((item) => item.carga_nominal),
    );
    return loads
      ? {
          message: `Cargas nominais cadastradas: ${loads}. Conferir compatibilidade com a capacidade prevista em planta.`,
        }
      : null;
  }

  if (
    sectionTitle === "Localizacao e Fixacao dos aparelhos extintores" &&
    itemNumber === "5"
  ) {
    if (wheeledExtinguishers.length === 0) {
      return {
        status: "NA",
        message: "Nenhum extintor sobre rodas cadastrado. Item tratado como nao aplicavel.",
      };
    }

    return {
      message: `${wheeledExtinguishers.length} extintor(es) sobre rodas cadastrado(s). Conferir se a localizacao corresponde a area protegida em planta.`,
    };
  }

  if (sectionTitle === "Condicoes dos Extintores" && itemNumber === "3") {
    if (expiredRecharge.length > 0) {
      return {
        status: "NC",
        message: `${expiredRecharge.length} extintor(es) com carga vencida. Item sinalizado automaticamente como nao conforme.`,
      };
    }

    return {
      status: "C",
      message: "Nenhum vencimento de carga em aberto entre os extintores cadastrados. Item sinalizado automaticamente como conforme.",
    };
  }

  if (sectionTitle === "Condicoes dos Extintores" && itemNumber === "8") {
    if (co2Extinguishers.length === 0) {
      return {
        status: "NA",
        message: "Nenhum extintor de CO2 cadastrado. Item tratado como nao aplicavel.",
      };
    }

    return {
      message: `${co2Extinguishers.length} extintor(es) de CO2 cadastrado(s). Conferir manualmente a presenca e integridade do difusor.`,
    };
  }

  if (sectionTitle === "Condicoes dos Extintores" && itemNumber === "11") {
    if (wheeledExtinguishers.length === 0) {
      return {
        status: "NA",
        message: "Nenhum extintor sobre rodas cadastrado. Item tratado como nao aplicavel.",
      };
    }

    return {
      message: `${wheeledExtinguishers.length} extintor(es) sobre rodas cadastrado(s). Conferir manualmente o funcionamento das rodas.`,
    };
  }

  return null;
};

export const loadChecklistEquipmentData = async (
  supabase: AppSupabaseClient,
  companyId: string,
) => {
  const [extinguishersResult, hydrantsResult] = await Promise.all([
    supabase
      .from("empresa_extintores")
      .select("*")
      .eq("empresa_id", companyId)
      .order("numero", { ascending: true }),
    supabase
      .from("empresa_hidrantes")
      .select("*")
      .eq("empresa_id", companyId)
      .order("numero", { ascending: true }),
  ]);

  const missingTables =
    (extinguishersResult.error &&
      isMissingRelationError(
        extinguishersResult.error,
        "empresa_extintores",
      )) ||
    (hydrantsResult.error &&
      isMissingRelationError(hydrantsResult.error, "empresa_hidrantes"));

  if (missingTables) {
    return {
      extinguishers: [] as ExtinguisherRecord[],
      hydrants: [] as HydrantRecord[],
      missingTables: true,
    };
  }

  if (extinguishersResult.error) {
    throw extinguishersResult.error;
  }

  if (hydrantsResult.error) {
    throw hydrantsResult.error;
  }

  return {
    extinguishers: sortByEquipmentNumber(extinguishersResult.data || []),
    hydrants: sortByEquipmentNumber(hydrantsResult.data || []),
    missingTables: false,
  };
};

export const saveExtinguisher = async (
  supabase: AppSupabaseClient,
  payload: ExtinguisherPayload,
  recordId?: string,
) => {
  if (recordId) {
    const updatePayload: TablesUpdate<"empresa_extintores"> = payload;
    const { data, error } = await supabase
      .from("empresa_extintores")
      .update(updatePayload)
      .eq("id", recordId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("empresa_extintores")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const deleteExtinguisher = async (
  supabase: AppSupabaseClient,
  recordId: string,
) => {
  const { error } = await supabase
    .from("empresa_extintores")
    .delete()
    .eq("id", recordId);

  if (error) {
    throw error;
  }
};

export const saveHydrant = async (
  supabase: AppSupabaseClient,
  payload: HydrantPayload,
  recordId?: string,
) => {
  if (recordId) {
    const updatePayload: TablesUpdate<"empresa_hidrantes"> = payload;
    const { data, error } = await supabase
      .from("empresa_hidrantes")
      .update(updatePayload)
      .eq("id", recordId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("empresa_hidrantes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const deleteHydrant = async (
  supabase: AppSupabaseClient,
  recordId: string,
) => {
  const { error } = await supabase
    .from("empresa_hidrantes")
    .delete()
    .eq("id", recordId);

  if (error) {
    throw error;
  }
};
