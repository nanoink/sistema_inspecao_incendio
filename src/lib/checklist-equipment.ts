import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import {
  buildChecklistSnapshot,
  type ChecklistGroupWithItems,
  type ChecklistModelShape,
  type ChecklistResponseShape,
  type ChecklistSnapshotInspection,
  type ChecklistSnapshotItem,
  type ChecklistSnapshotStatus,
} from "@/lib/checklist";
import {
  isMissingEquipmentQrSchemaError,
  isMissingRelationError,
} from "@/lib/supabase-errors";

type AppSupabaseClient = SupabaseClient<Database>;

export type EquipmentType = "extintor" | "hidrante" | "luminaria";
export type ExtinguisherRecord = Tables<"empresa_extintores">;
export type HydrantRecord = Tables<"empresa_hidrantes">;
export type LuminaireRecord = Tables<"empresa_luminarias">;
export type ExtinguisherPayload = TablesInsert<"empresa_extintores">;
export type HydrantPayload = TablesInsert<"empresa_hidrantes">;
export type LuminairePayload = TablesInsert<"empresa_luminarias">;
export type EquipmentPublicPageRecord =
  Database["public"]["Functions"]["get_equipment_qr_page"]["Returns"][number];
export type AutoChecklistStatus = "C" | "NC" | "NA";

export interface EquipmentChecklistSnapshot {
  generated_at: string | null;
  inspection_code: string;
  inspection_name: string;
  total: number;
  conforme: number;
  nao_conforme: number;
  nao_aplicavel: number;
  pendentes: number;
  items: ChecklistSnapshotItem[];
}

export interface EquipmentRuleEvaluation {
  status?: AutoChecklistStatus;
  message: string;
}

interface SaveEquipmentOptions {
  recordId?: string;
  existingToken?: string | null;
  existingSnapshot?: Json | null;
  checklistSnapshot?: EquipmentChecklistSnapshot;
}

const EXTINGUISHER_INSPECTION_CODE = "A.23";
const HYDRANT_INSPECTION_CODE = "A.25";
const LUMINAIRE_INSPECTION_CODE = "A.19";

const normalizeChecklistSectionTitleKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const buildChecklistSectionTitleSet = (titles: string[]) =>
  new Set(titles.map(normalizeChecklistSectionTitleKey));

// These sections are general system checks that must stay only on the
// principal checklist, not inside each individual equipment checklist.
const PRINCIPAL_ONLY_EQUIPMENT_SECTIONS: Record<string, Set<string>> = {
  [EXTINGUISHER_INSPECTION_CODE]: buildChecklistSectionTitleSet([
    "Documentacoes",
  ]),
  [HYDRANT_INSPECTION_CODE]: buildChecklistSectionTitleSet([
    "Reserva Tecnica de Incendio (RTI)",
    "Tubulacao da RTI a entrada da BCI - Succao",
    "Bombas de Combate a Incendio (BCI)",
    "Recalque (tubulacao da BCI aos hidrantes de parede/recalque)",
    "Procedimento de Testes",
    "Procedimento de teste quando houver uma unica BCI",
    "Procedimento de teste quando houver uma BCI e uma bomba de pressurizacao (joquei)",
    "Procedimento de teste apenas quando houver uma BCI Principal, uma BCI Reserva e uma bomba de pressurizacao (joquei)",
    "Notas Fiscais",
  ]),
  [LUMINAIRE_INSPECTION_CODE]: buildChecklistSectionTitleSet([
    "Sistema centralizado com baterias recarregaveis",
    "Sistema centralizado com grupo moto gerador (GMG)",
    "Teste do sistema centralizado com grupo moto gerador (GMG)",
    "ART/RRT",
    "Notas Fiscais",
    "Documentacoes especificos",
  ]),
};

const isPrincipalOnlyEquipmentChecklistSection = (
  inspectionCode: string,
  sectionTitle: string,
) => {
  const normalizedSectionTitle = normalizeChecklistSectionTitleKey(sectionTitle);

  if (!normalizedSectionTitle) {
    return false;
  }

  if (
    normalizedSectionTitle.startsWith("documentacao") &&
    normalizedSectionTitle.includes("art/rrt") &&
    (inspectionCode === HYDRANT_INSPECTION_CODE ||
      inspectionCode === LUMINAIRE_INSPECTION_CODE)
  ) {
    return true;
  }

  return (
    PRINCIPAL_ONLY_EQUIPMENT_SECTIONS[inspectionCode]?.has(
      normalizedSectionTitle,
    ) || false
  );
};

const filterEquipmentChecklistItemsForIndividualInspection = (
  inspectionCode: string,
  items: ChecklistSnapshotItem[],
) =>
  items.filter(
    (item) =>
      !isPrincipalOnlyEquipmentChecklistSection(inspectionCode, item.secao),
  );

const EMPTY_EQUIPMENT_CHECKLIST_SNAPSHOT: EquipmentChecklistSnapshot = {
  generated_at: null,
  inspection_code: "",
  inspection_name: "",
  total: 0,
  conforme: 0,
  nao_conforme: 0,
  nao_aplicavel: 0,
  pendentes: 0,
  items: [],
};

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
    loadOptions: [
      "2 kg",
      "4 kg",
      "6 kg",
      "8 kg",
      "12 kg",
      "20 kg",
      "25 kg",
      "50 kg",
      "75 kg",
    ],
  },
  {
    value: "Po BC",
    label: "Po Quimico Seco PQS - BC",
    loadOptions: [
      "2 kg",
      "4 kg",
      "6 kg",
      "8 kg",
      "12 kg",
      "20 kg",
      "25 kg",
      "50 kg",
      "75 kg",
    ],
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

export const LUMINAIRE_TYPE_OPTIONS = [
  {
    value: "LED Autonoma",
    label: "LED Autonoma",
    autonomy: "ate 8h",
  },
  {
    value: "Bloco Autonomo",
    label: "Bloco Autonomo",
    autonomy: "ate 12h",
  },
  {
    value: "Com Sensor de Falta de Energia",
    label: "Com Sensor de Falta de Energia",
    autonomy: "ate 8h",
  },
  {
    value: "Com Sinalizacao de Rotas de Fuga",
    label: "Com Sinalizacao de Rotas de Fuga",
    autonomy: "ate 8h",
  },
] as const;

export const LUMINAIRE_STATUS_OPTIONS = [
  { value: "Conforme", label: "Conforme" },
  { value: "Nao Conforme", label: "Nao Conforme" },
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown) =>
  typeof value === "string" ? value : "";

const toNullableStringValue = (value: unknown) =>
  typeof value === "string" ? value : null;

const toSnapshotItem = (value: unknown): ChecklistSnapshotItem | null => {
  if (!isObjectRecord(value)) {
    return null;
  }

  return {
    checklist_item_id: toStringValue(value.checklist_item_id),
    item_numero: toStringValue(value.item_numero),
    item_exibicao: toStringValue(value.item_exibicao),
    secao: toStringValue(value.secao),
    descricao: toStringValue(value.descricao),
    status:
      value.status === "C" ||
      value.status === "NC" ||
      value.status === "NA" ||
      value.status === "P"
        ? value.status
        : "P",
    observacoes: toNullableStringValue(value.observacoes),
  };
};

const getInspectionCodeForType = (equipmentType: EquipmentType) =>
  equipmentType === "extintor"
    ? EXTINGUISHER_INSPECTION_CODE
    : equipmentType === "hidrante"
      ? HYDRANT_INSPECTION_CODE
      : LUMINAIRE_INSPECTION_CODE;

const getTableNameForEquipmentType = (equipmentType: EquipmentType) =>
  equipmentType === "extintor"
    ? "empresa_extintores"
    : equipmentType === "hidrante"
      ? "empresa_hidrantes"
      : "empresa_luminarias";

export const buildEquipmentChecklistSnapshotFromItems = ({
  inspectionCode,
  inspectionName,
  items,
  generatedAt = new Date().toISOString(),
}: {
  inspectionCode: string;
  inspectionName: string;
  items: ChecklistSnapshotItem[];
  generatedAt?: string;
}): EquipmentChecklistSnapshot => ({
  generated_at: generatedAt,
  inspection_code: inspectionCode,
  inspection_name: inspectionName,
  total: items.length,
  conforme: items.filter((item) => item.status === "C").length,
  nao_conforme: items.filter((item) => item.status === "NC").length,
  nao_aplicavel: items.filter((item) => item.status === "NA").length,
  pendentes: items.filter((item) => item.status === "P").length,
  items,
});

const buildEquipmentChecklistSnapshotFromInspection = (
  inspection: ChecklistSnapshotInspection | undefined,
  generatedAt: string,
): EquipmentChecklistSnapshot => {
  if (!inspection) {
    return {
      ...EMPTY_EQUIPMENT_CHECKLIST_SNAPSHOT,
      generated_at: generatedAt,
    };
  }

  return buildEquipmentChecklistSnapshotFromItems({
    inspectionCode: inspection.codigo,
    inspectionName: inspection.nome,
    items: filterEquipmentChecklistItemsForIndividualInspection(
      inspection.codigo,
      inspection.itens,
    ),
    generatedAt,
  });
};

export const mergeEquipmentChecklistSnapshotWithTemplate = ({
  existingSnapshot,
  templateSnapshot,
  mode = "preserve",
}: {
  existingSnapshot?: Json | EquipmentChecklistSnapshot | null;
  templateSnapshot: EquipmentChecklistSnapshot;
  mode?: "preserve" | "overwrite";
}) => {
  const normalizedExisting = normalizeEquipmentChecklistSnapshot(existingSnapshot);

  if (normalizedExisting.items.length === 0) {
    return buildEquipmentChecklistSnapshotFromItems({
      inspectionCode: templateSnapshot.inspection_code,
      inspectionName: templateSnapshot.inspection_name,
      items: templateSnapshot.items,
      generatedAt: templateSnapshot.generated_at || new Date().toISOString(),
    });
  }

  const existingItemsById = new Map(
    normalizedExisting.items.map((item) => [item.checklist_item_id, item]),
  );

  const mergedItems = templateSnapshot.items.map((templateItem) => {
    const existingItem = existingItemsById.get(templateItem.checklist_item_id);
    if (!existingItem || mode === "overwrite") {
      return templateItem;
    }

    return {
      ...templateItem,
      status: existingItem.status,
      observacoes: existingItem.observacoes,
    };
  });

  return buildEquipmentChecklistSnapshotFromItems({
    inspectionCode: templateSnapshot.inspection_code,
    inspectionName: templateSnapshot.inspection_name,
    items: mergedItems,
  });
};

const buildEquipmentMetadata = async ({
  equipmentType,
  existingToken,
  existingSnapshot,
  checklistSnapshot,
}: {
  equipmentType: EquipmentType;
  existingToken?: string | null;
  existingSnapshot?: Json | null;
  checklistSnapshot?: EquipmentChecklistSnapshot;
}) => {
  const publicToken = existingToken || crypto.randomUUID();
  const qrCodeUrl = buildEquipmentPublicUrl(equipmentType, publicToken);
  const qrCodeSvg = await generateEquipmentQrSvg(qrCodeUrl);
  const nextChecklistSnapshot = checklistSnapshot
    ? mergeEquipmentChecklistSnapshotWithTemplate({
        existingSnapshot,
        templateSnapshot: checklistSnapshot,
        mode: "preserve",
      })
    : normalizeEquipmentChecklistSnapshot(existingSnapshot);

  return {
    public_token: publicToken,
    qr_code_url: qrCodeUrl,
    qr_code_svg: qrCodeSvg,
    checklist_snapshot:
      nextChecklistSnapshot.items.length > 0
        ? nextChecklistSnapshot
        : EMPTY_EQUIPMENT_CHECKLIST_SNAPSHOT,
  };
};

const withQrFallbackDefaults = <T extends Record<string, unknown>>(
  data: T,
  options: SaveEquipmentOptions,
) =>
  ({
    ...data,
    public_token:
      typeof data.public_token === "string"
        ? data.public_token
        : options.existingToken || "",
    qr_code_url:
      typeof data.qr_code_url === "string" ? data.qr_code_url : null,
    qr_code_svg:
      typeof data.qr_code_svg === "string" ? data.qr_code_svg : null,
    checklist_snapshot:
      data.checklist_snapshot ||
      options.existingSnapshot ||
      options.checklistSnapshot ||
      EMPTY_EQUIPMENT_CHECKLIST_SNAPSHOT,
  }) as T;

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

export const buildLuminaireSummary = (
  luminaires: LuminaireRecord[],
) => ({
  total: luminaires.length,
  conformes: luminaires.filter((item) => item.status === "Conforme").length,
  naoConformes: luminaires.filter((item) => item.status === "Nao Conforme")
    .length,
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

export const buildEquipmentPublicUrl = (
  equipmentType: EquipmentType,
  token: string,
  origin =
    (typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "") ||
    (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_PUBLIC_APP_URL?.trim()
      ? import.meta.env.VITE_PUBLIC_APP_URL.trim()
      : ""),
) => {
  const path = `/equipamentos/${equipmentType}/${token}`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
};

export const generateEquipmentQrSvg = async (url: string) => {
  const { toString } = await import("qrcode");

  return toString(url, {
    type: "svg",
    margin: 1,
    width: 256,
    color: {
      dark: "#111827",
      light: "#FFFFFFFF",
    },
  });
};

export const normalizeEquipmentChecklistSnapshot = (
  value?: Json | null,
): EquipmentChecklistSnapshot => {
  if (!isObjectRecord(value)) {
    return EMPTY_EQUIPMENT_CHECKLIST_SNAPSHOT;
  }

  const inspectionCode = toStringValue(value.inspection_code);
  const inspectionName = toStringValue(value.inspection_name);
  const items = Array.isArray(value.items)
    ? value.items
        .map((item) => toSnapshotItem(item))
        .filter((item): item is ChecklistSnapshotItem => item !== null)
    : [];
  const filteredItems = filterEquipmentChecklistItemsForIndividualInspection(
    inspectionCode,
    items,
  );

  return {
    generated_at: toNullableStringValue(value.generated_at),
    inspection_code: inspectionCode,
    inspection_name: inspectionName,
    total: filteredItems.length,
    conforme: filteredItems.filter((item) => item.status === "C").length,
    nao_conforme: filteredItems.filter((item) => item.status === "NC").length,
    nao_aplicavel: filteredItems.filter((item) => item.status === "NA").length,
    pendentes: filteredItems.filter((item) => item.status === "P").length,
    items: filteredItems,
  };
};

export const updateEquipmentChecklistSnapshotItemStatus = (
  snapshot: EquipmentChecklistSnapshot,
  itemId: string,
  status: ChecklistSnapshotStatus,
) =>
  updateEquipmentChecklistSnapshotItem(snapshot, itemId, { status });

export const updateEquipmentChecklistSnapshotItem = (
  snapshot: EquipmentChecklistSnapshot,
  itemId: string,
  updates: Partial<Pick<ChecklistSnapshotItem, "status" | "observacoes">>,
) =>
  buildEquipmentChecklistSnapshotFromItems({
    inspectionCode: snapshot.inspection_code,
    inspectionName: snapshot.inspection_name,
    items: snapshot.items.map((item) =>
      item.checklist_item_id === itemId
        ? {
            ...item,
            ...updates,
          }
        : item,
    ),
  });

export const buildEquipmentChecklistSnapshots = ({
  models,
  groupsByModel,
  responses,
}: {
  models: ChecklistModelShape[];
  groupsByModel: Map<string, ChecklistGroupWithItems[]>;
  responses: Map<string, ChecklistResponseShape>;
}) => {
  const fullSnapshot = buildChecklistSnapshot(models, groupsByModel, responses);
  const extinguisherInspection = fullSnapshot.inspections.find(
    (inspection) => inspection.codigo === EXTINGUISHER_INSPECTION_CODE,
  );
  const hydrantInspection = fullSnapshot.inspections.find(
    (inspection) => inspection.codigo === HYDRANT_INSPECTION_CODE,
  );
  const luminaireInspection = fullSnapshot.inspections.find(
    (inspection) => inspection.codigo === LUMINAIRE_INSPECTION_CODE,
  );

  return {
    luminaria: buildEquipmentChecklistSnapshotFromInspection(
      luminaireInspection,
      fullSnapshot.generated_at,
    ),
    extintor: buildEquipmentChecklistSnapshotFromInspection(
      extinguisherInspection,
      fullSnapshot.generated_at,
    ),
    hidrante: buildEquipmentChecklistSnapshotFromInspection(
      hydrantInspection,
      fullSnapshot.generated_at,
    ),
  };
};

export const syncEquipmentChecklistSnapshots = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    luminaireSnapshot,
    extinguisherSnapshot,
    hydrantSnapshot,
    mode = "preserve",
  }: {
    companyId: string;
    luminaireSnapshot: EquipmentChecklistSnapshot;
    extinguisherSnapshot: EquipmentChecklistSnapshot;
    hydrantSnapshot: EquipmentChecklistSnapshot;
    mode?: "preserve" | "overwrite";
  },
) => {
  const [luminairesResult, extinguishersResult, hydrantsResult] =
    await Promise.all([
      supabase
        .from("empresa_luminarias")
        .select("id, checklist_snapshot")
        .eq("empresa_id", companyId),
    supabase
      .from("empresa_extintores")
      .select("id, checklist_snapshot")
      .eq("empresa_id", companyId),
    supabase
      .from("empresa_hidrantes")
      .select("id, checklist_snapshot")
      .eq("empresa_id", companyId),
    ]);

  if (luminairesResult.error) {
    if (isMissingEquipmentQrSchemaError(luminairesResult.error)) {
      return false;
    }
    throw luminairesResult.error;
  }

  if (extinguishersResult.error) {
    if (isMissingEquipmentQrSchemaError(extinguishersResult.error)) {
      return false;
    }
    throw extinguishersResult.error;
  }

  if (hydrantsResult.error) {
    if (isMissingEquipmentQrSchemaError(hydrantsResult.error)) {
      return false;
    }
    throw hydrantsResult.error;
  }

  const luminaireUpdates = (luminairesResult.data || []).map((record) =>
    supabase
      .from("empresa_luminarias")
      .update({
        checklist_snapshot: mergeEquipmentChecklistSnapshotWithTemplate({
          existingSnapshot: record.checklist_snapshot,
          templateSnapshot: luminaireSnapshot,
          mode,
        }),
      })
      .eq("id", record.id),
  );

  const extUpdates = (extinguishersResult.data || []).map((record) =>
    supabase
      .from("empresa_extintores")
      .update({
        checklist_snapshot: mergeEquipmentChecklistSnapshotWithTemplate({
          existingSnapshot: record.checklist_snapshot,
          templateSnapshot: extinguisherSnapshot,
          mode,
        }),
      })
      .eq("id", record.id),
  );

  const hydrantUpdates = (hydrantsResult.data || []).map((record) =>
    supabase
      .from("empresa_hidrantes")
      .update({
        checklist_snapshot: mergeEquipmentChecklistSnapshotWithTemplate({
          existingSnapshot: record.checklist_snapshot,
          templateSnapshot: hydrantSnapshot,
          mode,
        }),
      })
      .eq("id", record.id),
  );

  const updateResults = await Promise.all([
    ...luminaireUpdates,
    ...extUpdates,
    ...hydrantUpdates,
  ]);

  const failedUpdate = updateResults.find((result) => result.error);
  if (failedUpdate?.error) {
    if (isMissingEquipmentQrSchemaError(failedUpdate.error)) {
      return false;
    }

    throw failedUpdate.error;
  }

  return true;
};

export const ensureEquipmentQrCodes = async (
  supabase: AppSupabaseClient,
  {
    luminaires,
    extinguishers,
    hydrants,
    luminaireSnapshot,
    extinguisherSnapshot,
    hydrantSnapshot,
  }: {
    luminaires: LuminaireRecord[];
    extinguishers: ExtinguisherRecord[];
    hydrants: HydrantRecord[];
    luminaireSnapshot: EquipmentChecklistSnapshot;
    extinguisherSnapshot: EquipmentChecklistSnapshot;
    hydrantSnapshot: EquipmentChecklistSnapshot;
  },
) => {
  const luminaireUpdates = await Promise.all(
    luminaires
      .filter((record) => !record.qr_code_svg || !record.qr_code_url)
      .map((record) =>
        saveLuminaire(
          supabase,
          {
            empresa_id: record.empresa_id,
            numero: record.numero,
            localizacao: record.localizacao,
            tipo_luminaria: record.tipo_luminaria,
            status: record.status,
          },
          {
            recordId: record.id,
            existingToken: record.public_token,
            existingSnapshot: record.checklist_snapshot,
            checklistSnapshot: luminaireSnapshot,
          },
        ),
      ),
  );

  const extinguisherUpdates = await Promise.all(
    extinguishers
      .filter((record) => !record.qr_code_svg || !record.qr_code_url)
      .map((record) =>
        saveExtinguisher(
          supabase,
          {
            empresa_id: record.empresa_id,
            numero: record.numero,
            localizacao: record.localizacao,
            tipo: record.tipo,
            carga_nominal: record.carga_nominal,
            vencimento_carga: record.vencimento_carga,
            vencimento_teste_hidrostatico_ano:
              record.vencimento_teste_hidrostatico_ano,
          },
          {
            recordId: record.id,
            existingToken: record.public_token,
            existingSnapshot: record.checklist_snapshot,
            checklistSnapshot: extinguisherSnapshot,
          },
        ),
      ),
  );

  const hydrantUpdates = await Promise.all(
    hydrants
      .filter((record) => !record.qr_code_svg || !record.qr_code_url)
      .map((record) =>
        saveHydrant(
          supabase,
          {
            empresa_id: record.empresa_id,
            numero: record.numero,
            localizacao: record.localizacao,
            tipo_hidrante: record.tipo_hidrante,
            mangueira1_tipo: record.mangueira1_tipo,
            mangueira1_vencimento_teste_hidrostatico:
              record.mangueira1_vencimento_teste_hidrostatico,
            mangueira2_tipo: record.mangueira2_tipo,
            mangueira2_vencimento_teste_hidrostatico:
              record.mangueira2_vencimento_teste_hidrostatico,
            esguicho: record.esguicho,
            chave_mangueira: record.chave_mangueira,
            status: record.status,
          },
          {
            recordId: record.id,
            existingToken: record.public_token,
            existingSnapshot: record.checklist_snapshot,
            checklistSnapshot: hydrantSnapshot,
          },
        ),
      ),
  );

  return {
    luminaires:
      luminaireUpdates.length === 0
        ? luminaires
        : sortByEquipmentNumber([
            ...luminaires.filter(
              (record) =>
                !luminaireUpdates.some((updated) => updated.id === record.id),
            ),
            ...luminaireUpdates,
          ]),
    extinguishers:
      extinguisherUpdates.length === 0
        ? extinguishers
        : sortByEquipmentNumber([
            ...extinguishers.filter(
              (record) =>
                !extinguisherUpdates.some((updated) => updated.id === record.id),
            ),
            ...extinguisherUpdates,
          ]),
    hydrants:
      hydrantUpdates.length === 0
        ? hydrants
        : sortByEquipmentNumber([
            ...hydrants.filter(
              (record) =>
                !hydrantUpdates.some((updated) => updated.id === record.id),
            ),
            ...hydrantUpdates,
          ]),
  };
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
        message:
          "Nenhum extintor sobre rodas cadastrado. Item tratado como nao aplicavel.",
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
      message:
        "Nenhum vencimento de carga em aberto entre os extintores cadastrados. Item sinalizado automaticamente como conforme.",
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
        message:
          "Nenhum extintor sobre rodas cadastrado. Item tratado como nao aplicavel.",
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
  const [luminairesResult, extinguishersResult, hydrantsResult] =
    await Promise.all([
      supabase
        .from("empresa_luminarias")
        .select("*")
        .eq("empresa_id", companyId)
        .order("numero", { ascending: true }),
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
    (luminairesResult.error &&
      isMissingRelationError(luminairesResult.error, "empresa_luminarias")) ||
    (extinguishersResult.error &&
      isMissingRelationError(
        extinguishersResult.error,
        "empresa_extintores",
      )) ||
    (hydrantsResult.error &&
      isMissingRelationError(hydrantsResult.error, "empresa_hidrantes"));

  if (missingTables) {
    return {
      luminaires: [] as LuminaireRecord[],
      extinguishers: [] as ExtinguisherRecord[],
      hydrants: [] as HydrantRecord[],
      missingTables: true,
    };
  }

  if (luminairesResult.error) {
    throw luminairesResult.error;
  }

  if (extinguishersResult.error) {
    throw extinguishersResult.error;
  }

  if (hydrantsResult.error) {
    throw hydrantsResult.error;
  }

  return {
    luminaires: sortByEquipmentNumber(luminairesResult.data || []),
    extinguishers: sortByEquipmentNumber(extinguishersResult.data || []),
    hydrants: sortByEquipmentNumber(hydrantsResult.data || []),
    missingTables: false,
  };
};

export const loadEquipmentQrPage = async (
  supabase: AppSupabaseClient,
  token: string,
  equipmentType?: EquipmentType | null,
) => {
  if (equipmentType === "extintor") {
    const { data, error } = await supabase
      .from("empresa_extintores")
      .select(
        "id, empresa_id, numero, localizacao, tipo, carga_nominal, vencimento_carga, vencimento_teste_hidrostatico_ano, checklist_snapshot, empresa:empresa_id(razao_social)",
      )
      .eq("public_token", token)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      equipment_type: "extintor",
      equipment_id: data.id,
      empresa_id: data.empresa_id,
      empresa_razao_social:
        typeof data.empresa === "object" &&
        data.empresa !== null &&
        "razao_social" in data.empresa
          ? String(data.empresa.razao_social || "")
          : "",
      numero: data.numero,
      localizacao: data.localizacao,
      titulo: `Extintor ${data.numero}`,
      subtitulo: `${data.tipo} - ${data.carga_nominal}`,
      qr_code_url: null,
      qr_code_svg: null,
      checklist_snapshot: data.checklist_snapshot,
      equipment_data: {
        numero: data.numero,
        localizacao: data.localizacao,
        tipo: data.tipo,
        carga_nominal: data.carga_nominal,
        vencimento_carga: data.vencimento_carga,
        vencimento_teste_hidrostatico_ano:
          data.vencimento_teste_hidrostatico_ano,
      },
    } satisfies EquipmentPublicPageRecord;
  }

  if (equipmentType === "hidrante") {
    const { data, error } = await supabase
      .from("empresa_hidrantes")
      .select(
        "id, empresa_id, numero, localizacao, tipo_hidrante, mangueira1_tipo, mangueira1_vencimento_teste_hidrostatico, mangueira2_tipo, mangueira2_vencimento_teste_hidrostatico, esguicho, chave_mangueira, status, checklist_snapshot, empresa:empresa_id(razao_social)",
      )
      .eq("public_token", token)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      equipment_type: "hidrante",
      equipment_id: data.id,
      empresa_id: data.empresa_id,
      empresa_razao_social:
        typeof data.empresa === "object" &&
        data.empresa !== null &&
        "razao_social" in data.empresa
          ? String(data.empresa.razao_social || "")
          : "",
      numero: data.numero,
      localizacao: data.localizacao,
      titulo: `Hidrante ${data.numero}`,
      subtitulo: data.tipo_hidrante,
      qr_code_url: null,
      qr_code_svg: null,
      checklist_snapshot: data.checklist_snapshot,
      equipment_data: {
        numero: data.numero,
        localizacao: data.localizacao,
        tipo_hidrante: data.tipo_hidrante,
        mangueira1_tipo: data.mangueira1_tipo,
        mangueira1_vencimento_teste_hidrostatico:
          data.mangueira1_vencimento_teste_hidrostatico,
        mangueira2_tipo: data.mangueira2_tipo,
        mangueira2_vencimento_teste_hidrostatico:
          data.mangueira2_vencimento_teste_hidrostatico,
        esguicho: data.esguicho,
        chave_mangueira: data.chave_mangueira,
        status: data.status,
      },
    } satisfies EquipmentPublicPageRecord;
  }

  if (equipmentType === "luminaria") {
    const { data, error } = await supabase
      .from("empresa_luminarias")
      .select(
        "id, empresa_id, numero, localizacao, tipo_luminaria, status, checklist_snapshot, empresa:empresa_id(razao_social)",
      )
      .eq("public_token", token)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      equipment_type: "luminaria",
      equipment_id: data.id,
      empresa_id: data.empresa_id,
      empresa_razao_social:
        typeof data.empresa === "object" &&
        data.empresa !== null &&
        "razao_social" in data.empresa
          ? String(data.empresa.razao_social || "")
          : "",
      numero: data.numero,
      localizacao: data.localizacao,
      titulo: `Luminaria ${data.numero}`,
      subtitulo: data.tipo_luminaria,
      qr_code_url: null,
      qr_code_svg: null,
      checklist_snapshot: data.checklist_snapshot,
      equipment_data: {
        numero: data.numero,
        localizacao: data.localizacao,
        tipo_luminaria: data.tipo_luminaria,
        status: data.status,
      },
    } satisfies EquipmentPublicPageRecord;
  }

  const { data, error } = await supabase
    .rpc("get_equipment_qr_page", { p_token: token })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const saveEquipmentQrChecklist = async (
  supabase: AppSupabaseClient,
  {
    token,
    checklistSnapshot,
  }: {
    token: string;
    checklistSnapshot: EquipmentChecklistSnapshot;
  },
) => {
  const { data, error } = await supabase
    .rpc("save_equipment_qr_checklist", {
      p_token: token,
      p_checklist_snapshot: checklistSnapshot,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const getNextEquipmentNumber = async (
  supabase: AppSupabaseClient,
  companyId: string,
  equipmentType: EquipmentType,
) => {
  const tableName = getTableNameForEquipmentType(equipmentType);
  const { data, count, error } = await supabase
    .from(tableName)
    .select("numero", { count: "exact" })
    .eq("empresa_id", companyId);

  if (error) {
    throw error;
  }

  const existingNumbers = new Set(
    (data || []).map((item) => item.numero.trim()).filter(Boolean),
  );
  let nextNumber = (count ?? data?.length ?? 0) + 1;

  while (existingNumbers.has(String(nextNumber))) {
    nextNumber += 1;
  }

  return String(nextNumber);
};

export const saveLuminaire = async (
  supabase: AppSupabaseClient,
  payload: LuminairePayload,
  options: SaveEquipmentOptions = {},
) => {
  const metadata = await buildEquipmentMetadata({
    equipmentType: "luminaria",
    existingToken: options.existingToken,
    existingSnapshot: options.existingSnapshot,
    checklistSnapshot: options.checklistSnapshot,
  });
  const nextPayload: LuminairePayload = {
    ...payload,
    ...metadata,
  };

  if (options.recordId) {
    const updatePayload: TablesUpdate<"empresa_luminarias"> = nextPayload;
    const result = await supabase
      .from("empresa_luminarias")
      .update(updatePayload)
      .eq("id", options.recordId)
      .select()
      .single();

    if (!result.error) {
      return result.data;
    }

    if (!isMissingEquipmentQrSchemaError(result.error)) {
      throw result.error;
    }

    const fallbackResult = await supabase
      .from("empresa_luminarias")
      .update(payload)
      .eq("id", options.recordId)
      .select()
      .single();

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return withQrFallbackDefaults(fallbackResult.data, options);
  }

  const result = await supabase
    .from("empresa_luminarias")
    .insert(nextPayload)
    .select()
    .single();

  if (!result.error) {
    return result.data;
  }

  if (!isMissingEquipmentQrSchemaError(result.error)) {
    throw result.error;
  }

  const fallbackResult = await supabase
    .from("empresa_luminarias")
    .insert(payload)
    .select()
    .single();

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return withQrFallbackDefaults(fallbackResult.data, options);
};

export const deleteLuminaire = async (
  supabase: AppSupabaseClient,
  recordId: string,
) => {
  const { error } = await supabase
    .from("empresa_luminarias")
    .delete()
    .eq("id", recordId);

  if (error) {
    throw error;
  }
};

export const saveExtinguisher = async (
  supabase: AppSupabaseClient,
  payload: ExtinguisherPayload,
  options: SaveEquipmentOptions = {},
) => {
  const metadata = await buildEquipmentMetadata({
    equipmentType: "extintor",
    existingToken: options.existingToken,
    existingSnapshot: options.existingSnapshot,
    checklistSnapshot: options.checklistSnapshot,
  });
  const nextPayload: ExtinguisherPayload = {
    ...payload,
    ...metadata,
  };

  if (options.recordId) {
    const updatePayload: TablesUpdate<"empresa_extintores"> = nextPayload;
    const result = await supabase
      .from("empresa_extintores")
      .update(updatePayload)
      .eq("id", options.recordId)
      .select()
      .single();

    if (!result.error) {
      return result.data;
    }

    if (!isMissingEquipmentQrSchemaError(result.error)) {
      throw result.error;
    }

    const fallbackResult = await supabase
      .from("empresa_extintores")
      .update(payload)
      .eq("id", options.recordId)
      .select()
      .single();

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return withQrFallbackDefaults(fallbackResult.data, options);
  }

  const result = await supabase
    .from("empresa_extintores")
    .insert(nextPayload)
    .select()
    .single();

  if (!result.error) {
    return result.data;
  }

  if (!isMissingEquipmentQrSchemaError(result.error)) {
    throw result.error;
  }

  const fallbackResult = await supabase
    .from("empresa_extintores")
    .insert(payload)
    .select()
    .single();

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return withQrFallbackDefaults(fallbackResult.data, options);
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
  options: SaveEquipmentOptions = {},
) => {
  const metadata = await buildEquipmentMetadata({
    equipmentType: "hidrante",
    existingToken: options.existingToken,
    existingSnapshot: options.existingSnapshot,
    checklistSnapshot: options.checklistSnapshot,
  });
  const nextPayload: HydrantPayload = {
    ...payload,
    ...metadata,
  };

  if (options.recordId) {
    const updatePayload: TablesUpdate<"empresa_hidrantes"> = nextPayload;
    const result = await supabase
      .from("empresa_hidrantes")
      .update(updatePayload)
      .eq("id", options.recordId)
      .select()
      .single();

    if (!result.error) {
      return result.data;
    }

    if (!isMissingEquipmentQrSchemaError(result.error)) {
      throw result.error;
    }

    const fallbackResult = await supabase
      .from("empresa_hidrantes")
      .update(payload)
      .eq("id", options.recordId)
      .select()
      .single();

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return withQrFallbackDefaults(fallbackResult.data, options);
  }

  const result = await supabase
    .from("empresa_hidrantes")
    .insert(nextPayload)
    .select()
    .single();

  if (!result.error) {
    return result.data;
  }

  if (!isMissingEquipmentQrSchemaError(result.error)) {
    throw result.error;
  }

  const fallbackResult = await supabase
    .from("empresa_hidrantes")
    .insert(payload)
    .select()
    .single();

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return withQrFallbackDefaults(fallbackResult.data, options);
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

export const getEquipmentChecklistSnapshotForType = (
  equipmentType: EquipmentType,
  snapshot?: Json | null,
) => {
  const normalized = normalizeEquipmentChecklistSnapshot(snapshot);
  const expectedCode = getInspectionCodeForType(equipmentType);

  if (normalized.inspection_code && normalized.inspection_code !== expectedCode) {
    return EMPTY_EQUIPMENT_CHECKLIST_SNAPSHOT;
  }

  return normalized;
};
