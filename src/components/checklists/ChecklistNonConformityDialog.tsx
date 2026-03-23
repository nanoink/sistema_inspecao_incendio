import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const canvasToJpegDataUrl = async (
  canvas: HTMLCanvasElement,
  quality: number,
) => {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) {
    throw new Error("Nao foi possivel converter a imagem para JPEG.");
  }

  return blobToDataUrl(blob);
};

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          "Nao foi possivel abrir a foto capturada. Tente novamente ou use uma imagem da galeria.",
        ),
      );
    };

    image.src = objectUrl;
  });

const downscaleImage = async (file: File) => {
  if (typeof window === "undefined") {
    return blobToDataUrl(file);
  }

  const image = await loadImageFromFile(file);

  const maxDimension = 1280;
  const minDimension = 320;
  const maxDataUrlLength = 320_000;
  const qualitySteps = [0.82, 0.72, 0.62, 0.52, 0.42, 0.32];
  let ratio = Math.min(1, maxDimension / image.width, maxDimension / image.height);
  let width = Math.max(1, Math.round(image.width * ratio));
  let height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return blobToDataUrl(file);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  let fallbackDataUrl = "";

  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualitySteps) {
      const compressedDataUrl = await canvasToJpegDataUrl(canvas, quality);
      fallbackDataUrl = compressedDataUrl;

      if (compressedDataUrl.length <= maxDataUrlLength) {
        return compressedDataUrl;
      }
    }

    if (Math.max(width, height) <= minDimension) {
      break;
    }

    width = Math.max(1, Math.round(width * 0.78));
    height = Math.max(1, Math.round(height * 0.78));
  }

  if (fallbackDataUrl && fallbackDataUrl.length <= maxDataUrlLength) {
    return fallbackDataUrl;
  }

  throw new Error(
    "A foto capturada ficou muito grande para salvar. Tente aproximar a camera do ponto da nao conformidade ou use uma imagem ja salva no aparelho.",
  );
};

interface ChecklistNonConformityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel?: string;
  initialDescription?: string | null;
  initialImageDataUrl?: string | null;
  saving?: boolean;
  onSave: (values: { description: string; imageDataUrl: string }) => Promise<void> | void;
}

export const ChecklistNonConformityDialog = ({
  open,
  onOpenChange,
  itemLabel,
  initialDescription,
  initialImageDataUrl,
  saving = false,
  onSave,
}: ChecklistNonConformityDialogProps) => {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDescription(initialDescription || "");
    setImageDataUrl(initialImageDataUrl || "");
    setProcessingImage(false);
  }, [initialDescription, initialImageDataUrl, open]);

  const handleFileSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setProcessingImage(true);
      const nextImageDataUrl = await downscaleImage(file);
      setImageDataUrl(nextImageDataUrl);
    } catch (error) {
      console.error("Error processing non conformity image:", error);
      toast({
        title: "Erro ao processar a imagem",
        description:
          error instanceof Error && error.message
            ? error.message
            : "Nao foi possivel preparar a foto para salvar a nao conformidade.",
        variant: "destructive",
      });
    } finally {
      setProcessingImage(false);
      event.target.value = "";
    }
  };

  const canSubmit =
    !saving &&
    !processingImage &&
    description.trim().length > 0 &&
    imageDataUrl.trim().length > 0;

  const handleSubmit = () =>
    onSave({
      description: description.trim(),
      imageDataUrl,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1rem)] max-w-md overflow-y-auto rounded-3xl border-0 p-0 shadow-2xl sm:max-h-[90vh]">
        <DialogHeader className="space-y-2 px-6 pb-0 pt-12 text-center">
          <DialogTitle className="text-2xl font-bold uppercase tracking-tight">
            Nao conformidade
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Registre a descricao e a imagem da nao conformidade para este item.
          </DialogDescription>
          {itemLabel ? (
            <p className="text-sm text-muted-foreground">{itemLabel}</p>
          ) : null}
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6 pt-2">
          <div className="space-y-2">
            <Label htmlFor="nao-conformidade-descricao">
              Descricao da nao conformidade
            </Label>
            <Textarea
              id="nao-conformidade-descricao"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva"
              className="min-h-[120px] resize-none rounded-2xl"
            />
          </div>

          <div className="space-y-3">
            <Label>Foto da nao conformidade</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelected}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelected}
              />

              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-0 bg-neutral-900 text-white hover:bg-neutral-800"
                disabled={saving || processingImage}
                onClick={() => cameraInputRef.current?.click()}
              >
                {processingImage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Foto
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-0 bg-neutral-900 text-white hover:bg-neutral-800"
                disabled={saving || processingImage}
                onClick={() => galleryInputRef.current?.click()}
              >
                {processingImage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                Imagem
              </Button>
            </div>

            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-dashed bg-muted/20",
                imageDataUrl ? "border-pink-200" : "border-muted-foreground/20",
              )}
            >
              {imageDataUrl ? (
                <div className="space-y-3 p-3">
                  <img
                    src={imageDataUrl}
                    alt="Nao conformidade"
                    className="max-h-64 w-full rounded-xl object-cover"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={saving || processingImage}
                      onClick={() => setImageDataUrl("")}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover imagem
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Adicione uma foto para registrar a nao conformidade.
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            disabled={!canSubmit}
            className="hidden h-12 w-full rounded-2xl bg-pink-300 text-base font-semibold text-white hover:bg-pink-400 sm:inline-flex"
            onClick={handleSubmit}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>

          <div className="-mx-6 sticky bottom-0 border-t bg-white/95 px-6 pb-6 pt-4 backdrop-blur sm:hidden">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-2xl"
                disabled={saving || processingImage}
                onClick={() => onOpenChange(false)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                disabled={!canSubmit}
                className="h-12 flex-1 rounded-2xl bg-pink-300 text-base font-semibold text-white hover:bg-pink-400"
                onClick={handleSubmit}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
