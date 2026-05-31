import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const canvasToJpegBlob = async (
  canvas: HTMLCanvasElement,
  quality: number,
) => {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) {
    throw new Error("Nao foi possivel converter a imagem para JPEG.");
  }

  return blob;
};

const TARGET_IMAGE_MAX_DIMENSION = 1280;
const TARGET_IMAGE_MIN_DIMENSION = 360;
const TARGET_IMAGE_MAX_BYTES = 480_000;
const IMAGE_QUALITY_STEPS = [0.84, 0.74, 0.64, 0.54, 0.44, 0.34];

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

const prepareImageForUpload = async (file: File) => {
  if (typeof window === "undefined") {
    return file as Blob;
  }

  const image = await loadImageFromFile(file);
  const ratio = Math.min(
    1,
    TARGET_IMAGE_MAX_DIMENSION / image.width,
    TARGET_IMAGE_MAX_DIMENSION / image.height,
  );
  let width = Math.max(1, Math.round(image.width * ratio));
  let height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return file as Blob;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  let fallbackBlob: Blob | null = null;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of IMAGE_QUALITY_STEPS) {
      const compressedBlob = await canvasToJpegBlob(canvas, quality);
      fallbackBlob = compressedBlob;

      if (compressedBlob.size <= TARGET_IMAGE_MAX_BYTES) {
        return new File(
          [compressedBlob],
          `nao-conformidade-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
            lastModified: Date.now(),
          },
        );
      }
    }

    if (Math.max(width, height) <= TARGET_IMAGE_MIN_DIMENSION) {
      break;
    }

    width = Math.max(1, Math.round(width * 0.76));
    height = Math.max(1, Math.round(height * 0.76));
  }

  if (fallbackBlob) {
    return new File([fallbackBlob], `nao-conformidade-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  return file as Blob;
};

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim() || "";
  return trimmed || "";
};

const canPersistImageValueInDraft = (value?: string | null) => {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return false;
  }

  return (
    !normalizedValue.startsWith("data:") &&
    !normalizedValue.startsWith("http://") &&
    !normalizedValue.startsWith("https://") &&
    !normalizedValue.startsWith("blob:") &&
    normalizedValue.length <= 512
  );
};

interface ChecklistNonConformityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel?: string;
  initialDescription?: string | null;
  initialImageValue?: string | null;
  initialImagePreviewUrl?: string | null;
  saving?: boolean;
  loading?: boolean;
  onSave: (values: {
    description: string;
    imageValue?: string | null;
    previousImageValue?: string | null;
    imageFile?: Blob | null;
  }) => Promise<void> | void;
}

export const ChecklistNonConformityDialog = ({
  open,
  onOpenChange,
  itemLabel,
  initialDescription,
  initialImageValue,
  initialImagePreviewUrl,
  saving = false,
  loading = false,
  onSave,
}: ChecklistNonConformityDialogProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [imageValue, setImageValue] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [previousImageValue, setPreviousImageValue] = useState("");
  const [imageUploadFile, setImageUploadFile] = useState<Blob | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const captureFlowInProgressRef = useRef(false);
  const visibilityResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const draftStorageKey = useMemo(
    () =>
      itemLabel
        ? `mobile-nc-draft:${itemLabel}`
        : "mobile-nc-draft:default",
    [itemLabel],
  );

  const revokePreviewObjectUrl = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  const applyPreviewUrl = useCallback((nextPreviewUrl?: string | null) => {
    revokePreviewObjectUrl();
    setImagePreviewUrl(normalizeOptionalString(nextPreviewUrl));
  }, [revokePreviewObjectUrl]);

  const applyPreviewBlob = useCallback((blob: Blob) => {
    revokePreviewObjectUrl();
    const objectUrl = URL.createObjectURL(blob);
    previewObjectUrlRef.current = objectUrl;
    setImagePreviewUrl(objectUrl);
  }, [revokePreviewObjectUrl]);

  const clearDraft = useCallback(() => {
    if (!isMobile || typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.removeItem(draftStorageKey);
    } catch (error) {
      console.error("Error clearing mobile non conformity draft:", error);
    }
  }, [draftStorageKey, isMobile]);

  const persistDraft = useCallback((
    nextDescription: string,
    nextImageValue: string,
  ) => {
    if (!isMobile || typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          description: nextDescription,
          imageValue: canPersistImageValueInDraft(nextImageValue)
            ? nextImageValue
            : "",
        }),
      );
    } catch (error) {
      console.error("Error persisting mobile non conformity draft:", error);
    }
  }, [draftStorageKey, isMobile]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextInitialDescription = normalizeOptionalString(initialDescription);
    const nextInitialImageValue = normalizeOptionalString(initialImageValue);
    const nextInitialPreviewUrl = normalizeOptionalString(
      initialImagePreviewUrl || initialImageValue,
    );

    let restoredDescription = nextInitialDescription;
    let restoredImageValue = nextInitialImageValue;

    if (isMobile && typeof window !== "undefined") {
      try {
        const storedDraft = window.sessionStorage.getItem(draftStorageKey);

        if (storedDraft) {
          const parsedDraft = JSON.parse(storedDraft) as {
            description?: string;
            imageValue?: string;
          };

          restoredDescription =
            normalizeOptionalString(parsedDraft.description) ||
            nextInitialDescription;

          restoredImageValue =
            normalizeOptionalString(parsedDraft.imageValue) ||
            nextInitialImageValue;
        }
      } catch (error) {
        console.error("Error restoring mobile non conformity draft:", error);
        clearDraft();
      }
    }

    setDescription(restoredDescription);
    setImageValue(restoredImageValue);
    setPreviousImageValue(nextInitialImageValue);
    setImageUploadFile(null);
    applyPreviewUrl(nextInitialPreviewUrl);
    setProcessingImage(false);
  }, [
    applyPreviewUrl,
    clearDraft,
    draftStorageKey,
    initialDescription,
    initialImagePreviewUrl,
    initialImageValue,
    isMobile,
    open,
  ]);

  useEffect(() => {
    if (!open || !isMobile) {
      return;
    }

    persistDraft(description, imageValue);
  }, [description, draftStorageKey, imageValue, isMobile, open, persistDraft]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      if (visibilityResetTimerRef.current) {
        clearTimeout(visibilityResetTimerRef.current);
      }

      visibilityResetTimerRef.current = setTimeout(() => {
        captureFlowInProgressRef.current = false;
      }, 600);
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (visibilityResetTimerRef.current) {
        clearTimeout(visibilityResetTimerRef.current);
      }
    };
  }, [isMobile]);

  useEffect(
    () => () => {
      revokePreviewObjectUrl();
    },
    [revokePreviewObjectUrl],
  );

  const handleFileSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    captureFlowInProgressRef.current = false;

    if (!file) {
      return;
    }

    try {
      setProcessingImage(true);
      const preparedImageFile = await prepareImageForUpload(file);
      setImageValue("");
      setImageUploadFile(preparedImageFile);
      applyPreviewBlob(preparedImageFile);
      persistDraft(description, "");
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
    !loading &&
    !processingImage &&
    description.trim().length > 0 &&
    (Boolean(imageUploadFile) || imageValue.trim().length > 0);

  const handleSubmit = () =>
    onSave({
      description: description.trim(),
      imageValue: imageValue.trim() || null,
      previousImageValue: previousImageValue.trim() || null,
      imageFile: imageUploadFile,
    });

  const handleCameraClick = () => {
    persistDraft(description, imageValue);
    captureFlowInProgressRef.current = true;
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    persistDraft(description, imageValue);
    galleryInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setImageValue("");
    setImageUploadFile(null);
    applyPreviewUrl("");
    persistDraft(description, "");
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isMobile && captureFlowInProgressRef.current) {
      return;
    }

    if (!nextOpen) {
      clearDraft();
      revokePreviewObjectUrl();
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-h-[calc(100vh-1rem)] max-w-md overflow-y-auto rounded-3xl border-0 p-0 shadow-2xl sm:max-h-[90vh]"
        onPointerDownOutside={(event) => {
          if (isMobile && captureFlowInProgressRef.current) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isMobile && captureFlowInProgressRef.current) {
            event.preventDefault();
          }
        }}
      >
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
                disabled={saving || loading || processingImage}
                onClick={handleCameraClick}
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
                disabled={saving || loading || processingImage}
                onClick={handleGalleryClick}
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
                imagePreviewUrl
                  ? "border-pink-200"
                  : "border-muted-foreground/20",
              )}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando imagem e descricao registradas...
                </div>
              ) : imagePreviewUrl ? (
                <div className="space-y-3 p-3">
                  <img
                    src={imagePreviewUrl}
                    alt="Nao conformidade"
                    className="max-h-64 w-full rounded-xl object-cover"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={saving || loading || processingImage}
                      onClick={handleRemoveImage}
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
                disabled={saving || loading || processingImage}
                onClick={() => {
                  clearDraft();
                  onOpenChange(false);
                }}
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
