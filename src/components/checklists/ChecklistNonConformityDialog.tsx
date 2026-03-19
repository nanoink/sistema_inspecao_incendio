import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const downscaleImage = async (file: File) => {
  const originalDataUrl = await fileToDataUrl(file);

  if (typeof window === "undefined") {
    return originalDataUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Nao foi possivel carregar a imagem."));
    element.src = originalDataUrl;
  });

  const maxDimension = 1600;
  const ratio = Math.min(1, maxDimension / image.width, maxDimension / image.height);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-0 p-0 shadow-2xl">
        <DialogHeader className="space-y-2 px-6 pb-0 pt-12 text-center">
          <DialogTitle className="text-2xl font-bold uppercase tracking-tight">
            Nao conformidade
          </DialogTitle>
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
            className="h-12 w-full rounded-2xl bg-pink-300 text-base font-semibold text-white hover:bg-pink-400"
            onClick={() =>
              onSave({
                description: description.trim(),
                imageDataUrl,
              })
            }
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
