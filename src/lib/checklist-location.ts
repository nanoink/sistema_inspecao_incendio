export interface ChecklistLocation {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  captured_at: string;
}

export type ChecklistLocationStatus =
  | "idle" | "requesting" | "captured" | "denied" | "timeout"
  | "unavailable" | "unsupported" | "insecure";

export const normalizeChecklistLocation = (value: unknown): ChecklistLocation | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.latitude !== "number" || !Number.isFinite(data.latitude) || Math.abs(data.latitude) > 90 ||
    typeof data.longitude !== "number" || !Number.isFinite(data.longitude) || Math.abs(data.longitude) > 180 ||
    typeof data.accuracy_m !== "number" || !Number.isFinite(data.accuracy_m) || data.accuracy_m < 0 ||
    typeof data.captured_at !== "string" || !Number.isFinite(Date.parse(data.captured_at))
  ) return null;
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy_m: data.accuracy_m,
    captured_at: new Date(data.captured_at).toISOString(),
  };
};

export const formatChecklistCoordinates = (location: ChecklistLocation) =>
  `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

export const buildChecklistMapsUrl = (value: unknown) => {
  const location = normalizeChecklistLocation(value);
  return location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`
    : null;
};

export const captureChecklistLocation = ({
  geolocation = typeof navigator === "undefined" ? null : navigator.geolocation,
  secureContext = typeof window !== "undefined" && window.isSecureContext,
  timeoutMs = 25_000,
}: {
  geolocation?: Pick<Geolocation, "getCurrentPosition"> | null;
  secureContext?: boolean;
  timeoutMs?: number;
} = {}): Promise<{ status: ChecklistLocationStatus; location: ChecklistLocation | null }> => {
  if (!secureContext) return Promise.resolve({ status: "insecure", location: null });
  if (!geolocation) return Promise.resolve({ status: "unsupported", location: null });

  return new Promise((resolve) => {
    let finished = false;
    const finish = (status: ChecklistLocationStatus, location: ChecklistLocation | null = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ status, location });
    };
    // O timeout nativo pode não contar o tempo em que a permissão está pendente.
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    try {
      geolocation.getCurrentPosition((position) => {
        if (!Number.isFinite(position.timestamp)) {
          finish("unavailable");
          return;
        }
        const location = normalizeChecklistLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          captured_at: new Date(position.timestamp).toISOString(),
        });
        finish(location ? "captured" : "unavailable", location);
      }, (error) => {
        finish(error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable");
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
    } catch {
      finish("unavailable");
    }
  });
};
