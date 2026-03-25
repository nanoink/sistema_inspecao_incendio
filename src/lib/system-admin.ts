export const SYSTEM_ADMIN_EMAIL = "firetetraedro@gmail.com";

export const normalizeEmail = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

export const isSystemAdminEmail = (email: string | null | undefined) =>
  normalizeEmail(email) === SYSTEM_ADMIN_EMAIL;
