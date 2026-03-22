import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  buildEquipmentPublicUrl,
  generateEquipmentQrSvg,
  type EquipmentType,
  type ExtinguisherRecord,
  type HydrantRecord,
  type LuminaireRecord,
} from "@/lib/checklist-equipment";

interface EquipmentQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentType: EquipmentType;
  record: LuminaireRecord | ExtinguisherRecord | HydrantRecord | null;
}

const getEquipmentLabel = (
  equipmentType: EquipmentType,
  record: LuminaireRecord | ExtinguisherRecord | HydrantRecord,
) =>
  equipmentType === "extintor"
    ? `Extintor ${record.numero}`
    : equipmentType === "hidrante"
      ? `Hidrante ${record.numero}`
      : `Luminaria ${record.numero}`;

const wrapCanvasText = ({
  context,
  text,
  maxWidth,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  maxWidth: number;
}) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${currentLine} ${words[index]}`;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = words[index];
  }

  lines.push(currentLine);
  return lines;
};

const getTitle = (
  equipmentType: EquipmentType,
  record: LuminaireRecord | ExtinguisherRecord | HydrantRecord,
) =>
  equipmentType === "extintor"
    ? `QR do extintor ${record.numero}`
    : equipmentType === "hidrante"
      ? `QR do hidrante ${record.numero}`
      : `QR da luminaria ${record.numero}`;

export const EquipmentQrDialog = ({
  open,
  onOpenChange,
  equipmentType,
  record,
}: EquipmentQrDialogProps) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState("");
  const [loadingQrCode, setLoadingQrCode] = useState(false);
  const qrCodeUrl = useMemo(() => {
    if (!record) {
      return "";
    }

    return record.public_token
      ? buildEquipmentPublicUrl(equipmentType, record.public_token)
      : record.qr_code_url || "";
  }, [equipmentType, record]);
  const downloadName = record
    ? `${equipmentType}-${record.numero}-qrcode.jpg`
    : "qrcode.jpg";

  useEffect(() => {
    let cancelled = false;

    const buildDynamicQrCode = async () => {
      if (!open || !record) {
        setQrCodeSvg("");
        setLoadingQrCode(false);
        return;
      }

      if (!qrCodeUrl) {
        setQrCodeSvg(record.qr_code_svg || "");
        setLoadingQrCode(false);
        return;
      }

      try {
        setLoadingQrCode(true);
        const nextSvg = await generateEquipmentQrSvg(qrCodeUrl);

        if (!cancelled) {
          setQrCodeSvg(nextSvg);
        }
      } catch (error) {
        console.error("Error generating dynamic QR code:", error);

        if (!cancelled) {
          setQrCodeSvg(record.qr_code_svg || "");
        }
      } finally {
        if (!cancelled) {
          setLoadingQrCode(false);
        }
      }
    };

    void buildDynamicQrCode();

    return () => {
      cancelled = true;
    };
  }, [open, qrCodeUrl, record]);

  const handleDownloadJpg = async () => {
    if (!qrCodeSvg || downloading || loadingQrCode) {
      return;
    }

    try {
      setDownloading(true);

      const svgBlob = new Blob([qrCodeSvg], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () =>
          reject(new Error("Nao foi possivel carregar o SVG do QR Code."));
        nextImage.src = svgUrl;
      });

      const equipmentLabel = record
        ? getEquipmentLabel(equipmentType, record)
        : "Equipamento";
      const equipmentLocation = record?.localizacao?.trim()
        ? `Localizacao: ${record.localizacao.trim()}`
        : "Localizacao nao informada";

      const canvasWidth = 1200;
      const qrSize = 820;
      const padding = 120;
      const footerHeight = 210;
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = padding + qrSize + 40 + footerHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Nao foi possivel preparar o canvas para download.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        (canvas.width - qrSize) / 2,
        padding,
        qrSize,
        qrSize,
      );

      const footerTop = padding + qrSize + 55;
      const maxTextWidth = canvas.width - padding * 2;

      context.textAlign = "center";
      context.fillStyle = "#111111";
      context.font = "bold 42px Arial";
      context.fillText(equipmentLabel, canvas.width / 2, footerTop);

      context.fillStyle = "#444444";
      context.font = "30px Arial";
      const locationLines = wrapCanvasText({
        context,
        text: equipmentLocation,
        maxWidth: maxTextWidth,
      });

      locationLines.slice(0, 2).forEach((line, lineIndex) => {
        context.fillText(
          line,
          canvas.width / 2,
          footerTop + 52 + lineIndex * 38,
        );
      });

      const jpgBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.96);
      });

      if (!jpgBlob) {
        throw new Error("Nao foi possivel converter o QR Code para JPG.");
      }

      const jpgUrl = URL.createObjectURL(jpgBlob);
      const link = document.createElement("a");
      link.href = jpgUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(svgUrl);
      URL.revokeObjectURL(jpgUrl);
    } catch (error) {
      console.error("Error downloading QR Code JPG:", error);
      toast({
        title: "Erro ao baixar QR",
        description: "Nao foi possivel gerar a imagem JPG do QR Code.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

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
              {loadingQrCode ? (
                <div className="flex aspect-square max-w-[240px] items-center justify-center mx-auto text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : qrCodeSvg ? (
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
                <Button
                  type="button"
                  onClick={() => void handleDownloadJpg()}
                  disabled={downloading || loadingQrCode}
                >
                  {loadingQrCode
                    ? "Gerando QR..."
                    : downloading
                      ? "Gerando JPG..."
                      : "Baixar QR"}
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
