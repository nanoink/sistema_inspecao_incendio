export interface EquipmentChecklistSyncEvent {
  companyId: string;
  updatedAt: string;
}

const CHANNEL_NAME = "equipment-checklist-sync";
const STORAGE_KEY = "equipment-checklist-sync-event";

const parseSyncEvent = (value: string | null): EquipmentChecklistSyncEvent | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<EquipmentChecklistSyncEvent>;

    if (
      typeof parsed.companyId !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    return {
      companyId: parsed.companyId,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

export const broadcastEquipmentChecklistUpdate = (companyId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const payload: EquipmentChecklistSyncEvent = {
    companyId,
    updatedAt: new Date().toISOString(),
  };

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage sync issues and keep the broadcast best-effort.
  }
};

export const subscribeEquipmentChecklistUpdates = (
  callback: (event: EquipmentChecklistSyncEvent) => void,
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let channel: BroadcastChannel | null = null;

  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<EquipmentChecklistSyncEvent>) => {
      callback(event.data);
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    const payload = parseSyncEvent(event.newValue);
    if (payload) {
      callback(payload);
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);

    if (channel) {
      channel.close();
    }
  };
};
