import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export interface EquipmentNonConformityEntry {
  equipmentTypeLabel: string;
  equipmentNumber: string;
  location: string;
  description: string;
  imageDataUrl: string | null;
}

interface EquipmentNonConformitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel?: string;
  entries: EquipmentNonConformityEntry[];
  onSelectEntry: (entry: EquipmentNonConformityEntry) => void;
}

export const EquipmentNonConformitiesDialog = ({
  open,
  onOpenChange,
  itemLabel,
  entries,
  onSelectEntry,
}: EquipmentNonConformitiesDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Equipamentos nao conformes</DialogTitle>
        <DialogDescription>
          {itemLabel
            ? `Selecione um equipamento para visualizar a nao conformidade registrada no ${itemLabel}.`
            : "Selecione um equipamento para visualizar a nao conformidade registrada."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma nao conformidade registrada para este item.
          </div>
        ) : (
          entries.map((entry) => (
            <button
              key={`${entry.equipmentTypeLabel}-${entry.equipmentNumber}-${entry.location}`}
              type="button"
              onClick={() => onSelectEntry(entry)}
              className="w-full rounded-2xl border bg-background p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {entry.equipmentTypeLabel} {entry.equipmentNumber}
                </Badge>
                <Badge variant="secondary">{entry.location}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                {entry.description}
              </p>
              <div className="mt-3 text-right text-xs font-semibold uppercase tracking-wide text-primary">
                Abrir nao conformidade
              </div>
            </button>
          ))
        )}
      </div>
    </DialogContent>
  </Dialog>
);

interface EquipmentNonConformityViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel?: string;
  entry: EquipmentNonConformityEntry | null;
}

export const EquipmentNonConformityViewerDialog = ({
  open,
  onOpenChange,
  itemLabel,
  entry,
}: EquipmentNonConformityViewerDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {entry
            ? `${entry.equipmentTypeLabel} ${entry.equipmentNumber}`
            : "Nao conformidade"}
        </DialogTitle>
        <DialogDescription>
          {itemLabel
            ? `${itemLabel}${entry ? ` | ${entry.location}` : ""}`
            : entry?.location || "Registro de nao conformidade"}
        </DialogDescription>
      </DialogHeader>

      {entry ? (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Descricao</p>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {entry.description}
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Imagem</p>
            {entry.imageDataUrl ? (
              <img
                src={entry.imageDataUrl}
                alt="Nao conformidade registrada"
                className="mt-3 max-h-[420px] w-full rounded-xl object-cover"
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma imagem foi anexada neste registro.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </DialogContent>
  </Dialog>
);
