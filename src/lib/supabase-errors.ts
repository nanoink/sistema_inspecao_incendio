interface SupabaseErrorShape {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}

export const isMissingRelationError = (
  error: unknown,
  relationName?: string,
) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseErrorShape;
  const combinedMessage = [
    candidate.message || "",
    candidate.details || "",
    candidate.hint || "",
  ]
    .join(" ")
    .toLowerCase();

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
