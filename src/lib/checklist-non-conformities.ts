import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Tables,
  TablesInsert,
} from "@/integrations/supabase/types";
import {
  loadEquipmentQrPage,
  type EquipmentType,
} from "@/lib/checklist-equipment";
import {
  resolveActiveReportCycleId,
  resolveEditableReportCycleId,
} from "@/lib/report-cycles";
import { isMissingColumnError } from "@/lib/supabase-errors";

type AppSupabaseClient = SupabaseClient<Database>;

export type NonConformityEquipmentType =
  | "extintor"
  | "hidrante"
  | "luminaria";
export type ChecklistNonConformityRecord =
  Tables<"empresa_checklist_nao_conformidades"> & {
    imagem_original_value?: string | null;
    imagem_preview_url?: string | null;
  };
type ChecklistNonConformityPayload =
  TablesInsert<"empresa_checklist_nao_conformidades">;

const LIGHTWEIGHT_NON_CONFORMITY_COLUMNS =
  "id, context_key, empresa_id, relatorio_ciclo_id, checklist_item_id, equipment_type, equipment_record_id, descricao, created_at, updated_at";
const NON_CONFORMITY_IMAGE_STORAGE_BUCKET =
  "empresa-checklist-nao-conformidades";
const NON_CONFORMITY_IMAGE_STORAGE_PREFIX = "storage://";
const SIGNED_URL_DURATION_SECONDS = 60 * 60 * 12;
const STORAGE_UPLOAD_FALLBACK_CONTENT_TYPE = "image/jpeg";
const INLINE_IMAGE_FALLBACK_MAX_BYTES = 700_000;
const CHECKLIST_NON_CONFORMITY_SELECT_WITH_CYCLE =
  "id, context_key, empresa_id, relatorio_ciclo_id, checklist_item_id, equipment_type, equipment_record_id, descricao, created_at, updated_at";
const CHECKLIST_NON_CONFORMITY_SELECT_LEGACY =
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

interface ChecklistNonConformityImageSaveOptions {
  companyId: string;
  checklistItemId: string;
  equipmentType?: NonConformityEquipmentType | null;
  equipmentRecordId?: string | null;
  imageValue?: string | null;
  previousImageValue?: string | null;
  imageFile?: Blob | null;
}

interface SaveEquipmentQrNonConformityOptions {
  token: string;
  checklistItemId: string;
  description: string;
  imageValue?: string | null;
  previousImageValue?: string | null;
  imageFile?: Blob | null;
  companyId?: string | null;
  equipmentType?: EquipmentType | null;
  equipmentRecordId?: string | null;
}

interface SaveChecklistNonConformityOptions {
  companyId: string;
  checklistItemId: string;
  description: string;
  imageValue?: string | null;
  previousImageValue?: string | null;
  imageFile?: Blob | null;
  equipmentType?: NonConformityEquipmentType | null;
  equipmentRecordId?: string | null;
}

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim() || "";
  return trimmed || null;
};

const getChecklistNonConformityErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    const normalizedMessage = error.message.trim();
    return normalizedMessage || null;
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    error_description?: string;
  };
  const parts = [
    candidate.message,
    candidate.details,
    candidate.hint,
    candidate.error_description,
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : null;
};

const buildChecklistNonConformitySaveError = (
  error: unknown,
  fallbackMessage: string,
) => new Error(getChecklistNonConformityErrorMessage(error) || fallbackMessage);

const createClientSideId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}`;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const normalizeStorageObjectFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

const getBlobExtension = (blob: Blob) => {
  const normalizedType = blob.type.trim().toLowerCase();

  if (normalizedType === "image/png") {
    return "png";
  }

  if (normalizedType === "image/webp") {
    return "webp";
  }

  return "jpg";
};

const isEquipmentScope = (
  scope: ChecklistNonConformityScope,
): scope is EquipmentScope =>
  !!scope.equipmentType && !!scope.equipmentRecordId;

const isDataUrl = (value: string) => value.startsWith("data:");
const isHttpUrl = (value: string) =>
  /^https?:\/\//i.test(value);
const isBlobUrl = (value: string) => value.startsWith("blob:");

const parseChecklistNonConformityStorageReference = (value?: string | null) => {
  const normalizedValue = normalizeOptionalString(value);

  if (
    !normalizedValue ||
    !normalizedValue.startsWith(NON_CONFORMITY_IMAGE_STORAGE_PREFIX)
  ) {
    return null;
  }

  const withoutPrefix = normalizedValue.slice(
    NON_CONFORMITY_IMAGE_STORAGE_PREFIX.length,
  );
  const slashIndex = withoutPrefix.indexOf("/");

  if (slashIndex <= 0 || slashIndex === withoutPrefix.length - 1) {
    return null;
  }

  return {
    bucket: withoutPrefix.slice(0, slashIndex),
    path: withoutPrefix.slice(slashIndex + 1),
  };
};

const buildChecklistNonConformityStorageReference = (
  bucket: string,
  path: string,
) => `${NON_CONFORMITY_IMAGE_STORAGE_PREFIX}${bucket}/${path}`;

const buildChecklistNonConformityImageUploadPath = ({
  companyId,
  checklistItemId,
  equipmentType,
  equipmentRecordId,
  blob,
}: {
  companyId: string;
  checklistItemId: string;
  equipmentType?: NonConformityEquipmentType | null;
  equipmentRecordId?: string | null;
  blob: Blob;
}) => {
  const extension = getBlobExtension(blob);
  const normalizedChecklistItemId = normalizeStorageObjectFileName(
    checklistItemId,
  );
  const scopePath =
    equipmentType && equipmentRecordId
      ? `${equipmentType}/${equipmentRecordId}`
      : "principal";

  return `${companyId}/checklist-non-conformities/${scopePath}/${normalizedChecklistItemId}/${Date.now()}-${createClientSideId()}.${extension}`;
};

const removeChecklistNonConformityStoredImage = async (
  supabase: AppSupabaseClient,
  value?: string | null,
) => {
  const storageReference = parseChecklistNonConformityStorageReference(value);

  if (!storageReference) {
    return;
  }

  await supabase.storage
    .from(storageReference.bucket)
    .remove([storageReference.path])
    .catch(() => undefined);
};

const resolveExistingImageValueForSave = ({
  imageValue,
  previousImageValue,
  imageFile,
}: Pick<
  ChecklistNonConformityImageSaveOptions,
  "imageValue" | "previousImageValue" | "imageFile"
>) => {
  const normalizedImageValue = normalizeOptionalString(imageValue);
  const normalizedPreviousValue = normalizeOptionalString(previousImageValue);

  if (imageFile) {
    return normalizedImageValue;
  }

  if (
    normalizedImageValue &&
    !isHttpUrl(normalizedImageValue) &&
    !isBlobUrl(normalizedImageValue)
  ) {
    return normalizedImageValue;
  }

  if (normalizedPreviousValue) {
    return normalizedPreviousValue;
  }

  return normalizedImageValue;
};

const uploadChecklistNonConformityImage = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    checklistItemId,
    equipmentType,
    equipmentRecordId,
    imageFile,
  }: Pick<
    ChecklistNonConformityImageSaveOptions,
    "companyId" | "checklistItemId" | "equipmentType" | "equipmentRecordId" | "imageFile"
  >,
) => {
  if (!imageFile) {
    throw new Error("Nenhuma imagem foi fornecida para upload.");
  }

  const uploadedFilePath = buildChecklistNonConformityImageUploadPath({
    companyId,
    checklistItemId,
    equipmentType,
    equipmentRecordId,
    blob: imageFile,
  });
  const { error } = await supabase.storage
    .from(NON_CONFORMITY_IMAGE_STORAGE_BUCKET)
    .upload(uploadedFilePath, imageFile, {
      contentType:
        normalizeOptionalString(imageFile.type) ||
        STORAGE_UPLOAD_FALLBACK_CONTENT_TYPE,
    });

  if (error) {
    throw error;
  }

  return buildChecklistNonConformityStorageReference(
    NON_CONFORMITY_IMAGE_STORAGE_BUCKET,
    uploadedFilePath,
  );
};

const resolveChecklistNonConformityImageValueForSave = async (
  supabase: AppSupabaseClient,
  options: ChecklistNonConformityImageSaveOptions,
) => {
  const previousImageValue = normalizeOptionalString(options.previousImageValue);
  const existingImageValue = resolveExistingImageValueForSave(options);
  let nextImageValue = existingImageValue;
  let uploadedImageValue: string | null = null;

  if (options.imageFile) {
    try {
      uploadedImageValue = await uploadChecklistNonConformityImage(
        supabase,
        options,
      );
      nextImageValue = uploadedImageValue;
    } catch (uploadError) {
      console.error(
        "Error uploading checklist non conformity image to storage. Falling back to inline image data:",
        uploadError,
      );

      if (options.imageFile.size > INLINE_IMAGE_FALLBACK_MAX_BYTES) {
        throw new Error(
          "Nao foi possivel enviar a imagem da nao conformidade. A foto preparada ainda ficou acima do limite seguro para salvamento no celular/tablet.",
        );
      }

      nextImageValue = await blobToDataUrl(options.imageFile);
    }
  }

  return {
    nextImageValue,
    previousImageValue,
    uploadedImageValue,
  };
};

const upsertChecklistNonConformityRecord = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    checklistItemId,
    description,
    imageValue,
    equipmentType,
    equipmentRecordId,
  }: {
    companyId: string;
    checklistItemId: string;
    description: string;
    imageValue?: string | null;
    equipmentType?: NonConformityEquipmentType | null;
    equipmentRecordId?: string | null;
  },
) => {
  let editableReportCycleId: string | null = null;

  try {
    editableReportCycleId = await resolveEditableReportCycleId(
      supabase,
      companyId,
    );
  } catch (cycleError) {
    console.warn(
      "Error resolving editable report cycle for checklist non conformity. Falling back to persistence without report cycle binding:",
      cycleError,
    );
  }

  const payload: ChecklistNonConformityPayload = {
    relatorio_ciclo_id: editableReportCycleId ?? undefined,
    context_key: buildChecklistNonConformityContextKey({
      companyId,
      reportCycleId: editableReportCycleId,
      checklistItemId,
      equipmentType,
      equipmentRecordId,
    }),
    empresa_id: companyId,
    checklist_item_id: checklistItemId,
    equipment_type: equipmentType ?? null,
    equipment_record_id: equipmentRecordId ?? null,
    descricao: description.trim(),
    imagem_data_url: imageValue ?? null,
  };

  const { data, error } = await supabase
    .from("empresa_checklist_nao_conformidades")
    .upsert(payload, { onConflict: "context_key" })
    .select(CHECKLIST_NON_CONFORMITY_SELECT_WITH_CYCLE)
    .maybeSingle();

  if (!error) {
    return data as ChecklistNonConformityRecord | null;
  }

  if (!isMissingColumnError(error, ["relatorio_ciclo_id"])) {
    throw error;
  }

  const legacyPayload = {
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
    imagem_data_url: imageValue ?? null,
  } satisfies ChecklistNonConformityPayload;

  const legacyResult = await supabase
    .from("empresa_checklist_nao_conformidades")
    .upsert(legacyPayload, { onConflict: "context_key" })
    .select(CHECKLIST_NON_CONFORMITY_SELECT_LEGACY)
    .maybeSingle();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return (legacyResult.data || null) as ChecklistNonConformityRecord | null;
};

const hydrateChecklistNonConformityImageRecord = async (
  supabase: AppSupabaseClient,
  record: ChecklistNonConformityRecord,
) => {
  const originalValue = normalizeOptionalString(
    record.imagem_original_value ?? record.imagem_data_url,
  );

  if (!originalValue) {
    return {
      ...record,
      imagem_data_url: null,
      imagem_original_value: null,
      imagem_preview_url: null,
    } satisfies ChecklistNonConformityRecord;
  }

  if (isDataUrl(originalValue) || isHttpUrl(originalValue)) {
    return {
      ...record,
      imagem_data_url: originalValue,
      imagem_original_value: originalValue,
      imagem_preview_url: originalValue,
    } satisfies ChecklistNonConformityRecord;
  }

  const storageReference =
    parseChecklistNonConformityStorageReference(originalValue);

  if (!storageReference) {
    return {
      ...record,
      imagem_data_url: originalValue,
      imagem_original_value: originalValue,
      imagem_preview_url: originalValue,
    } satisfies ChecklistNonConformityRecord;
  }

  const { data, error } = await supabase.storage
    .from(storageReference.bucket)
    .createSignedUrl(storageReference.path, SIGNED_URL_DURATION_SECONDS);

  if (error) {
    console.error(
      `Error creating signed URL for checklist non conformity ${record.id}:`,
      error,
    );

    return {
      ...record,
      imagem_data_url: null,
      imagem_original_value: originalValue,
      imagem_preview_url: null,
    } satisfies ChecklistNonConformityRecord;
  }

  const signedUrl = data?.signedUrl || null;

  return {
    ...record,
    imagem_data_url: signedUrl,
    imagem_original_value: originalValue,
    imagem_preview_url: signedUrl,
  } satisfies ChecklistNonConformityRecord;
};

export const hydrateChecklistNonConformityImageRecords = async (
  supabase: AppSupabaseClient,
  records: ChecklistNonConformityRecord[],
) =>
  Promise.all(
    records.map((record) =>
      hydrateChecklistNonConformityImageRecord(supabase, record),
    ),
  );

export const getChecklistNonConformityImageStoredValue = (
  record?: ChecklistNonConformityRecord | null,
) =>
  normalizeOptionalString(record?.imagem_original_value ?? record?.imagem_data_url);

export const getChecklistNonConformityImagePreviewUrl = (
  record?: ChecklistNonConformityRecord | null,
) =>
  normalizeOptionalString(record?.imagem_preview_url ?? record?.imagem_data_url);

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

export const buildChecklistNonConformityContextKey = ({
  companyId,
  reportCycleId,
  checklistItemId,
  equipmentType,
  equipmentRecordId,
}: {
  companyId: string;
  reportCycleId?: string | null;
  checklistItemId: string;
  equipmentType?: NonConformityEquipmentType | null;
  equipmentRecordId?: string | null;
}) =>
  equipmentType && equipmentRecordId
    ? `${companyId}:${reportCycleId || "sem-ciclo"}:${equipmentType}:${equipmentRecordId}:${checklistItemId}`
    : `${companyId}:${reportCycleId || "sem-ciclo"}:principal:${checklistItemId}`;

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
  const activeReportCycleId = await resolveActiveReportCycleId(
    supabase,
    scope.companyId,
  );

  let query = supabase
    .from("empresa_checklist_nao_conformidades")
    .select(includeImageData ? "*" : LIGHTWEIGHT_NON_CONFORMITY_COLUMNS)
    .eq("empresa_id", scope.companyId)
    .order("updated_at", { ascending: false });

  if (activeReportCycleId) {
    query = query.eq("relatorio_ciclo_id", activeReportCycleId);
  }

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

  if (error && isMissingColumnError(error, ["relatorio_ciclo_id"])) {
    let fallbackQuery = supabase
      .from("empresa_checklist_nao_conformidades")
      .select(
        includeImageData
          ? "*"
          : LIGHTWEIGHT_NON_CONFORMITY_COLUMNS.replace("relatorio_ciclo_id, ", ""),
      )
      .eq("empresa_id", scope.companyId)
      .order("updated_at", { ascending: false });

    if (scope.checklistItemId) {
      fallbackQuery = fallbackQuery.eq(
        "checklist_item_id",
        scope.checklistItemId,
      );
    }

    if (isEquipmentScope(scope)) {
      fallbackQuery = fallbackQuery
        .eq("equipment_type", scope.equipmentType)
        .eq("equipment_record_id", scope.equipmentRecordId);
    } else {
      fallbackQuery = fallbackQuery
        .is("equipment_type", null)
        .is("equipment_record_id", null);
    }

    const fallbackResult = await fallbackQuery;

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    const fallbackRecords = ((fallbackResult.data || []) as ChecklistNonConformityRecord[]).map(
      (record) =>
        includeImageData
          ? record
          : ({
              ...record,
              imagem_data_url: null,
            } satisfies ChecklistNonConformityRecord),
    );

    return includeImageData
      ? hydrateChecklistNonConformityImageRecords(supabase, fallbackRecords)
      : fallbackRecords;
  }

  if (error) {
    throw error;
  }

  const records = ((data || []) as ChecklistNonConformityRecord[]).map((record) =>
    includeImageData
      ? record
      : ({
          ...record,
          imagem_data_url: null,
        } satisfies ChecklistNonConformityRecord),
  );

  return includeImageData
    ? hydrateChecklistNonConformityImageRecords(supabase, records)
    : records;
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
  const activeReportCycleId = await resolveActiveReportCycleId(supabase, companyId);

  let query = supabase
    .from("empresa_checklist_nao_conformidades")
    .select("*")
    .eq("empresa_id", companyId)
    .eq("equipment_type", equipmentType)
    .order("updated_at", { ascending: false });

  if (activeReportCycleId) {
    query = query.eq("relatorio_ciclo_id", activeReportCycleId);
  }

  const { data, error } = await query;

  if (error && isMissingColumnError(error, ["relatorio_ciclo_id"])) {
    const fallbackResult = await supabase
      .from("empresa_checklist_nao_conformidades")
      .select("*")
      .eq("empresa_id", companyId)
      .eq("equipment_type", equipmentType)
      .order("updated_at", { ascending: false });

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return hydrateChecklistNonConformityImageRecords(
      supabase,
      (fallbackResult.data || []) as ChecklistNonConformityRecord[],
    );
  }

  if (error) {
    throw error;
  }

  return hydrateChecklistNonConformityImageRecords(
    supabase,
    (data || []) as ChecklistNonConformityRecord[],
  );
};

export const loadAllChecklistNonConformitiesForActiveCycle = async (
  supabase: AppSupabaseClient,
  companyId: string,
) => {
  const activeReportCycleId = await resolveActiveReportCycleId(supabase, companyId);

  let query = supabase
    .from("empresa_checklist_nao_conformidades")
    .select("*")
    .eq("empresa_id", companyId)
    .order("updated_at", { ascending: false });

  if (activeReportCycleId) {
    query = query.eq("relatorio_ciclo_id", activeReportCycleId);
  }

  const { data, error } = await query;

  if (error && isMissingColumnError(error, ["relatorio_ciclo_id"])) {
    const fallbackResult = await supabase
      .from("empresa_checklist_nao_conformidades")
      .select("*")
      .eq("empresa_id", companyId)
      .order("updated_at", { ascending: false });

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return hydrateChecklistNonConformityImageRecords(
      supabase,
      (fallbackResult.data || []) as ChecklistNonConformityRecord[],
    );
  }

  if (error) {
    throw error;
  }

  return hydrateChecklistNonConformityImageRecords(
    supabase,
    (data || []) as ChecklistNonConformityRecord[],
  );
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

  return hydrateChecklistNonConformityImageRecords(
    supabase,
    (data || []) as ChecklistNonConformityRecord[],
  );
};

export const saveEquipmentQrNonConformity = async (
  supabase: AppSupabaseClient,
  {
    token,
    checklistItemId,
    description,
    imageValue,
    previousImageValue,
    imageFile,
    companyId,
    equipmentType,
    equipmentRecordId,
  }: SaveEquipmentQrNonConformityOptions,
) => {
  let resolvedCompanyId = normalizeOptionalString(companyId);
  let resolvedEquipmentType =
    equipmentType === "extintor" ||
    equipmentType === "hidrante" ||
    equipmentType === "luminaria"
      ? equipmentType
      : null;
  let resolvedEquipmentRecordId = normalizeOptionalString(equipmentRecordId);

  if (imageFile && (!resolvedCompanyId || !resolvedEquipmentType || !resolvedEquipmentRecordId)) {
    const equipmentQrRecord = await loadEquipmentQrPage(
      supabase,
      token,
      resolvedEquipmentType,
    );

    if (!equipmentQrRecord) {
      throw new Error(
        "Nao foi possivel localizar o equipamento para salvar a imagem da nao conformidade.",
      );
    }

    resolvedCompanyId = equipmentQrRecord.empresa_id;
    resolvedEquipmentType = equipmentQrRecord.equipment_type;
    resolvedEquipmentRecordId = equipmentQrRecord.equipment_id;
  }

  const {
    nextImageValue,
    previousImageValue: normalizedPreviousImageValue,
    uploadedImageValue,
  } =
    resolvedCompanyId && imageFile
      ? await resolveChecklistNonConformityImageValueForSave(supabase, {
          companyId: resolvedCompanyId,
          checklistItemId,
          equipmentType: resolvedEquipmentType,
          equipmentRecordId: resolvedEquipmentRecordId,
          imageValue,
          previousImageValue,
          imageFile,
        })
      : {
          nextImageValue: resolveExistingImageValueForSave({
            imageValue,
            previousImageValue,
            imageFile,
          }),
          previousImageValue: normalizeOptionalString(previousImageValue),
          uploadedImageValue: null,
        };

  try {
    const { data, error } = await supabase.rpc(
      "save_equipment_qr_non_conformity",
      {
        p_token: token,
        p_checklist_item_id: checklistItemId,
        p_descricao: description.trim(),
        p_imagem_data_url: nextImageValue,
      },
    );

    if (error) {
      throw error;
    }

    if (
      normalizedPreviousImageValue &&
      normalizedPreviousImageValue !== nextImageValue
    ) {
      await removeChecklistNonConformityStoredImage(
        supabase,
        normalizedPreviousImageValue,
      );
    }

      const savedRecord = (data?.[0] || null) as ChecklistNonConformityRecord | null;

      if (!savedRecord) {
        return null;
      }

    const [hydratedRecord] = await hydrateChecklistNonConformityImageRecords(
      supabase,
      [
        {
          ...savedRecord,
          imagem_data_url: nextImageValue,
        } satisfies ChecklistNonConformityRecord,
      ],
    );

      return hydratedRecord || null;
  } catch (error) {
    if (
      resolvedCompanyId &&
      resolvedEquipmentType &&
      resolvedEquipmentRecordId
    ) {
      try {
        console.warn(
          "Error saving QR non conformity through RPC. Retrying with direct checklist non conformity upsert:",
          error,
        );

        return await saveChecklistNonConformity(supabase, {
          companyId: resolvedCompanyId,
          checklistItemId,
          description,
          imageValue: nextImageValue,
          previousImageValue: normalizedPreviousImageValue,
          imageFile: null,
          equipmentType: resolvedEquipmentType,
          equipmentRecordId: resolvedEquipmentRecordId,
        });
      } catch (fallbackError) {
        if (uploadedImageValue) {
          await removeChecklistNonConformityStoredImage(
            supabase,
            uploadedImageValue,
          );
        }

        throw buildChecklistNonConformitySaveError(
          fallbackError,
          "Nao foi possivel registrar a descricao e a imagem desta nao conformidade.",
        );
      }
    }

    if (uploadedImageValue) {
      await removeChecklistNonConformityStoredImage(supabase, uploadedImageValue);
    }

    throw buildChecklistNonConformitySaveError(
      error,
      "Nao foi possivel registrar a descricao e a imagem desta nao conformidade.",
    );
  }
};

export const saveChecklistNonConformity = async (
  supabase: AppSupabaseClient,
  {
    companyId,
    checklistItemId,
    description,
    imageValue,
    previousImageValue,
    imageFile,
    equipmentType,
    equipmentRecordId,
  }: SaveChecklistNonConformityOptions,
) => {
  const {
    nextImageValue,
    previousImageValue: normalizedPreviousImageValue,
    uploadedImageValue,
  } = await resolveChecklistNonConformityImageValueForSave(supabase, {
    companyId,
    checklistItemId,
    equipmentType,
    equipmentRecordId,
    imageValue,
    previousImageValue,
    imageFile,
  });

  try {
    const data = await upsertChecklistNonConformityRecord(supabase, {
      companyId,
      checklistItemId,
      description,
      imageValue: nextImageValue,
      equipmentType,
      equipmentRecordId,
    });

    if (
      normalizedPreviousImageValue &&
      normalizedPreviousImageValue !== nextImageValue
    ) {
      await removeChecklistNonConformityStoredImage(
        supabase,
        normalizedPreviousImageValue,
      );
    }

    if (!data) {
      return null;
    }

    const [hydratedRecord] = await hydrateChecklistNonConformityImageRecords(
      supabase,
      [
        {
          ...data,
          imagem_data_url: nextImageValue,
        } satisfies ChecklistNonConformityRecord,
      ],
    );

    return hydratedRecord || null;
  } catch (error) {
    if (uploadedImageValue) {
      await removeChecklistNonConformityStoredImage(supabase, uploadedImageValue);
    }

    throw buildChecklistNonConformitySaveError(
      error,
      "Nao foi possivel registrar a descricao e a imagem desta nao conformidade.",
    );
  }
};
