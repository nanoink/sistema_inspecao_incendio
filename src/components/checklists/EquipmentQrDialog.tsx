import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type {
  EquipmentType,
  ExtinguisherRecord,
  HydrantRecord,
} from "@/lib/checklist-equipment";

interface EquipmentQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentType: EquipmentType;
  record: ExtinguisherRecord | HydrantRecord | null;
}

const getTitle = (
  equipmentType: EquipmentType,
  record: ExtinguisherRecord | HydrantRecord,
) =>
  equipmentType === "extintor"
    ? `QR do extintor ${record.numero}`
    : `QR do hidrante ${record.numero}`;

export const EquipmentQrDialog = ({
  open,
  onOpenChange,
  equipmentType,
  record,
}: EquipmentQrDialogProps) => {
  const qrCodeUrl = record?.qr_code_url || "";
  const qrCodeSvg = record?.qr_code_svg || "";
  const downloadName = record
    ? `${equipmentType}-${record.numero}-qrcode.svg`
    : "qrcode.svg";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {record ? getTitle(equipmentType, record) : "QR do equipamento"}
          </DialogTitle>
          <DialogDescription>
            Ao ler este QR Code, a ficha publica do equipamento e o checklist espelhado serao exibidos.
          </DialogDescription>
        </DialogHeader>

        {record ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4">
              {qrCodeSvg ? (
                <div
                  className="mx-auto aspect-square max-w-[240px]"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  O QR Code ainda nao foi gerado para este equipamento.
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground break-all">
              {qrCodeUrl || "Link indisponivel"}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {qrCodeUrl ? (
                <Button type="button" variant="outline" asChild>
                  <a href={qrCodeUrl} target="_blank" rel="noreferrer">
                    Abrir ficha
                  </a>
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled>
                  Abrir ficha
                </Button>
              )}
              {qrCodeSvg ? (
                <Button type="button" asChild>
                  <a
                    href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCodeSvg)}`}
                    download={downloadName}
                  >
                    Baixar QR
                  </a>
                </Button>
              ) : (
                <Button type="button" disabled>
                  Baixar QR
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
