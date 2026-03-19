interface SupabaseErrorShape {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}

const getCombinedMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as SupabaseErrorShape;
  return [candidate.message || "", candidate.details || "", candidate.hint || ""]
    .join(" ")
    .toLowerCase();
};

export const isMissingRelationError = (
  error: unknown,
  relationName?: string,
) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseErrorShape;
  const combinedMessage = getCombinedMessage(error);

  const mentionsRelation = relationName
    ? combinedMessage.includes(relationName.toLowerCase())
    : true;

  return (
    candidate.code === "PGRST205" ||
    candidate.code === "42P01" ||
    (mentionsRelation &&
      (combinedMessage.includes("could not find the table") ||
        combinedMessage.includes("schema cache") ||
        combinedMessage.includes("does not exist") ||
        combinedMessage.includes("relation") ||
        combinedMessage.includes("not found")))
  );
};

export const isMissingColumnError = (
  error: unknown,
  columnNames?: string[],
) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseErrorShape;
  const combinedMessage = getCombinedMessage(error);
  const mentionsColumn = columnNames?.length
    ? columnNames.some((columnName) =>
        combinedMessage.includes(columnName.toLowerCase()),
      )
    : true;

  return (
    candidate.code === "PGRST204" ||
    candidate.code === "42703" ||
    (mentionsColumn &&
      (combinedMessage.includes("column") ||
        combinedMessage.includes("schema cache") ||
        combinedMessage.includes("could not find the") ||
        combinedMessage.includes("does not exist")))
  );
};

export const isMissingFunctionError = (
  error: unknown,
  functionName?: string,
) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseErrorShape;
  const combinedMessage = getCombinedMessage(error);
  const mentionsFunction = functionName
    ? combinedMessage.includes(functionName.toLowerCase())
    : true;

  return (
    candidate.code === "PGRST202" ||
    candidate.code === "42883" ||
    (mentionsFunction &&
      (combinedMessage.includes("function") ||
        combinedMessage.includes("schema cache") ||
        combinedMessage.includes("does not exist") ||
        combinedMessage.includes("not found")))
  );
};

export const isMissingEquipmentQrSchemaError = (error: unknown) =>
  isMissingColumnError(error, [
    "public_token",
    "qr_code_url",
    "qr_code_svg",
    "checklist_snapshot",
  ]) || isMissingFunctionError(error, "get_equipment_qr_page");
