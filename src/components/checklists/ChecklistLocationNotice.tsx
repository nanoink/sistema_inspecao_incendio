import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildChecklistMapsUrl, formatChecklistCoordinates, type ChecklistLocation, type ChecklistLocationStatus } from "@/lib/checklist-location";

const messages: Record<ChecklistLocationStatus, string> = {
  idle: "A localização será solicitada para registrar o local da inspeção.",
  requesting: "Obtendo localização. Se solicitado, permita o acesso no navegador.",
  captured: "Localização obtida para as respostas desta inspeção.",
  denied: "Permissão negada. Libere a localização nas configurações deste site e tente novamente.",
  timeout: "A localização não foi obtida a tempo. Verifique o GPS e tente novamente.",
  unavailable: "Localização indisponível. Verifique o GPS e as permissões do dispositivo.",
  unsupported: "Este navegador não oferece acesso à localização.",
  insecure: "A localização requer acesso por HTTPS (ou localhost em desenvolvimento).",
};

export const ChecklistLocationNotice = ({ status, location, onRetry }: {
  status: ChecklistLocationStatus;
  location: ChecklistLocation | null;
  onRetry: () => void;
}) => (
  <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite">
    <div className="flex items-start gap-3">
      {status === "requesting" ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
      <div className="space-y-1">
        <p className="font-medium">{messages[status]}</p>
        {location ? <p className="text-xs text-muted-foreground"><a href={buildChecklistMapsUrl(location) || undefined} target="_blank" rel="noopener noreferrer" className="underline">{formatChecklistCoordinates(location)}</a> · Precisão aproximada: {Math.ceil(location.accuracy_m)} m</p> : <p className="text-xs text-muted-foreground">O checklist pode ser preenchido. Novas respostas sem localização aparecerão como “Não registrada” no relatório.</p>}
      </div>
    </div>
    <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={status === "requesting" || status === "unsupported" || status === "insecure"} onClick={onRetry}>{location ? "Atualizar localização" : "Tentar localização"}</Button>
  </div>
);
