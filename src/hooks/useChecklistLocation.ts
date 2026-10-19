import { useCallback, useEffect, useRef, useState } from "react";
import { captureChecklistLocation, type ChecklistLocation, type ChecklistLocationStatus } from "@/lib/checklist-location";

export const useChecklistLocation = (scopeKey: string | null) => {
  const requestId = useRef({ value: 0 });
  const pendingRequest = useRef<{
    scopeKey: string;
    promise: ReturnType<typeof captureChecklistLocation>;
  } | null>(null);
  const [state, setState] = useState<{
    scopeKey: string | null;
    status: ChecklistLocationStatus;
    location: ChecklistLocation | null;
  }>({ scopeKey: null, status: "idle", location: null });

  const requestLocation = useCallback(() => {
    if (!scopeKey) return;
    const currentRequest = ++requestId.current.value;
    setState({ scopeKey, status: "requesting", location: null });
    const promise = captureChecklistLocation();
    pendingRequest.current = { scopeKey, promise };
    void promise.then((result) => {
      if (requestId.current.value === currentRequest) setState({ scopeKey, ...result });
    });
  }, [scopeKey]);

  useEffect(() => {
    const generation = requestId.current;
    if (scopeKey) requestLocation();
    else setState({ scopeKey: null, status: "idle", location: null });
    return () => { generation.value++; };
  }, [scopeKey, requestLocation]);

  return {
    status: state.scopeKey === scopeKey ? state.status : "idle" as ChecklistLocationStatus,
    location: state.scopeKey === scopeKey ? state.location : null,
    requestLocation,
    waitForLocation: async () => pendingRequest.current?.scopeKey === scopeKey
      ? (await pendingRequest.current.promise).location
      : null,
  };
};
