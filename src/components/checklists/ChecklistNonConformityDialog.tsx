import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Camera, Check, ImagePlus, Loader2, RefreshCcw, Trash2 } from "lucide-react";
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
const TARGET_CAMERA_IMAGE_MAX_BYTES = 360_000;
const IMAGE_QUALITY_STEPS = [0.84, 0.74, 0.64, 0.54, 0.44, 0.34];
const MOBILE_CAMERA_DRAFT_MAX_BYTES = 900_000;

type NonConformityImageSource = "camera" | "gallery";

interface MobileNonConformityDraft {
  description?: string;
  imageValue?: string;
  cameraImageDataUrl?: string;
  cameraImageFileName?: string;
}

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

const prepareImageForUpload = async (
  file: File,
  source: NonConformityImageSource,
) => {
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
  const targetMaxBytes = source === "camera"
    ? TARGET_CAMERA_IMAGE_MAX_BYTES
    : TARGET_IMAGE_MAX_BYTES;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of IMAGE_QUALITY_STEPS) {
      const compressedBlob = await canvasToJpegBlob(canvas, quality);
      fallbackBlob = compressedBlob;

      if (compressedBlob.size <= targetMaxBytes) {
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

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const dataUrlToFile = (dataUrl: string, fileName: string) => {
  const [header, encodedBody] = dataUrl.split(",", 2);

  if (!header || !encodedBody) {
    return null;
  }

  const mimeTypeMatch = header.match(/^data:(.*?);base64$/i);
  const mimeType = mimeTypeMatch?.[1] || "image/jpeg";

  try {
    const binary = window.atob(encodedBody);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], fileName, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch {
    return null;
  }
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

const isAndroidCameraFlowSupported = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    /android/i.test(window.navigator.userAgent || "") &&
    typeof window.navigator.mediaDevices?.getUserMedia === "function"
  );
};

const getCameraAccessErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "O navegador nao recebeu permissao para usar a camera. Libere a camera nas permissoes do site e tente novamente.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "Nenhuma camera foi encontrada neste dispositivo.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "A camera do dispositivo esta ocupada por outro aplicativo. Feche outros apps que usam a camera e tente novamente.";
    }
  }

  return "Nao foi possivel abrir a camera do dispositivo. Tente novamente ou use a galeria.";
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
  const [inlineCameraOpen, setInlineCameraOpen] = useState(false);
  const [startingInlineCamera, setStartingInlineCamera] = useState(false);
  const [capturedInlineCameraBlob, setCapturedInlineCameraBlob] = useState<Blob | null>(null);
  const [capturedInlineCameraPreviewUrl, setCapturedInlineCameraPreviewUrl] = useState("");
  const [inlineCameraError, setInlineCameraError] = useState("");
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const inlineCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const inlineCameraStreamRef = useRef<MediaStream | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const inlineCameraPreviewObjectUrlRef = useRef<string | null>(null);
  const captureFlowInProgressRef = useRef(false);
  const visibilityResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const inlineCameraRequestIdRef = useRef(0);
  const draftStorageKey = useMemo(
    () =>
      itemLabel
        ? `mobile-nc-draft:${itemLabel}`
        : "mobile-nc-draft:default",
    [itemLabel],
  );
  const useInlineAndroidCamera = useMemo(() => isAndroidCameraFlowSupported(), []);

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

  const revokeInlineCameraPreviewObjectUrl = useCallback(() => {
    if (inlineCameraPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(inlineCameraPreviewObjectUrlRef.current);
      inlineCameraPreviewObjectUrlRef.current = null;
    }
  }, []);

  const applyInlineCameraPreviewBlob = useCallback((blob: Blob) => {
    revokeInlineCameraPreviewObjectUrl();
    const objectUrl = URL.createObjectURL(blob);
    inlineCameraPreviewObjectUrlRef.current = objectUrl;
    setCapturedInlineCameraPreviewUrl(objectUrl);
  }, [revokeInlineCameraPreviewObjectUrl]);

  const stopInlineCameraStream = useCallback(() => {
    inlineCameraStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    inlineCameraStreamRef.current = null;

    if (inlineCameraVideoRef.current) {
      inlineCameraVideoRef.current.srcObject = null;
    }
  }, []);

  const resetInlineCameraState = useCallback(() => {
    stopInlineCameraStream();
    revokeInlineCameraPreviewObjectUrl();
    setInlineCameraOpen(false);
    setStartingInlineCamera(false);
    setCapturedInlineCameraBlob(null);
    setCapturedInlineCameraPreviewUrl("");
    setInlineCameraError("");
  }, [revokeInlineCameraPreviewObjectUrl, stopInlineCameraStream]);

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
    options?: {
      cameraImageDataUrl?: string | null;
      cameraImageFileName?: string | null;
    },
  ) => {
    if (!isMobile || typeof window === "undefined") {
      return;
    }

    try {
      const currentDraftRaw = window.sessionStorage.getItem(draftStorageKey);
      const currentDraft = currentDraftRaw
        ? (JSON.parse(currentDraftRaw) as MobileNonConformityDraft)
        : null;
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          description: nextDescription,
          imageValue: canPersistImageValueInDraft(nextImageValue)
            ? nextImageValue
            : "",
          cameraImageDataUrl:
            options?.cameraImageDataUrl !== undefined
              ? options.cameraImageDataUrl || ""
              : currentDraft?.cameraImageDataUrl || "",
          cameraImageFileName:
            options?.cameraImageFileName !== undefined
              ? options.cameraImageFileName || ""
              : currentDraft?.cameraImageFileName || "",
        }),
      );
    } catch (error) {
      console.error("Error persisting mobile non conformity draft:", error);
    }
  }, [draftStorageKey, isMobile]);

  useEffect(() => {
    if (!open) {
      resetInlineCameraState();
      return;
    }

    const nextInitialDescription = normalizeOptionalString(initialDescription);
    const nextInitialImageValue = normalizeOptionalString(initialImageValue);
    const nextInitialPreviewUrl = normalizeOptionalString(
      initialImagePreviewUrl || initialImageValue,
    );

    let restoredDescription = nextInitialDescription;
    let restoredImageValue = nextInitialImageValue;
    let restoredCameraImageDataUrl = "";
    let restoredCameraImageFileName = "";

    if (isMobile && typeof window !== "undefined") {
      try {
        const storedDraft = window.sessionStorage.getItem(draftStorageKey);

        if (storedDraft) {
          const parsedDraft = JSON.parse(storedDraft) as MobileNonConformityDraft;

          restoredDescription =
            normalizeOptionalString(parsedDraft.description) ||
            nextInitialDescription;

          restoredImageValue =
            normalizeOptionalString(parsedDraft.imageValue) ||
            nextInitialImageValue;
          restoredCameraImageDataUrl = normalizeOptionalString(
            parsedDraft.cameraImageDataUrl,
          );
          restoredCameraImageFileName = normalizeOptionalString(
            parsedDraft.cameraImageFileName,
          );
        }
      } catch (error) {
        console.error("Error restoring mobile non conformity draft:", error);
        clearDraft();
      }
    }

    setDescription(restoredDescription);
    setPreviousImageValue(nextInitialImageValue);
    if (restoredCameraImageDataUrl) {
      const restoredCameraFile = dataUrlToFile(
        restoredCameraImageDataUrl,
        restoredCameraImageFileName || `nao-conformidade-${Date.now()}.jpg`,
      );
      setImageValue(restoredCameraFile ? "" : restoredCameraImageDataUrl);
      setImageUploadFile(restoredCameraFile);
      applyPreviewUrl(restoredCameraImageDataUrl);
    } else {
      setImageValue(restoredImageValue);
      setImageUploadFile(null);
      applyPreviewUrl(nextInitialPreviewUrl);
    }
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
    resetInlineCameraState,
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
      stopInlineCameraStream();
      revokeInlineCameraPreviewObjectUrl();
      revokePreviewObjectUrl();
    },
    [revokeInlineCameraPreviewObjectUrl, revokePreviewObjectUrl, stopInlineCameraStream],
  );

  const startInlineCamera = useCallback(async () => {
    if (!useInlineAndroidCamera || typeof window === "undefined") {
      return false;
    }

    const requestId = inlineCameraRequestIdRef.current + 1;
    inlineCameraRequestIdRef.current = requestId;

    stopInlineCameraStream();
    setInlineCameraError("");
    setStartingInlineCamera(true);

    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });

      if (
        inlineCameraRequestIdRef.current !== requestId ||
        !inlineCameraOpen
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      inlineCameraStreamRef.current = stream;

      if (inlineCameraVideoRef.current) {
        inlineCameraVideoRef.current.srcObject = stream;
        await inlineCameraVideoRef.current.play().catch(() => undefined);
      }

      return true;
    } catch (error) {
      console.error("Error starting inline Android camera capture:", error);
      setInlineCameraError(getCameraAccessErrorMessage(error));
      return false;
    } finally {
      if (inlineCameraRequestIdRef.current === requestId) {
        setStartingInlineCamera(false);
      }
    }
  }, [inlineCameraOpen, stopInlineCameraStream, useInlineAndroidCamera]);

  useEffect(() => {
    if (!inlineCameraOpen || capturedInlineCameraBlob || !useInlineAndroidCamera) {
      return;
    }

    void startInlineCamera();
  }, [
    capturedInlineCameraBlob,
    inlineCameraOpen,
    startInlineCamera,
    useInlineAndroidCamera,
  ]);

  const applySelectedImage = useCallback(async (
    file: File,
    source: NonConformityImageSource,
  ) => {
    setProcessingImage(true);
    const preparedImageFile = await prepareImageForUpload(file, source);
    setImageValue("");
    setImageUploadFile(preparedImageFile);
    applyPreviewBlob(preparedImageFile);

    if (
      source === "camera" &&
      preparedImageFile.size <= MOBILE_CAMERA_DRAFT_MAX_BYTES
    ) {
      const preparedImageDataUrl = await blobToDataUrl(preparedImageFile);
      persistDraft(description, "", {
        cameraImageDataUrl: preparedImageDataUrl,
        cameraImageFileName:
          preparedImageFile instanceof File
            ? preparedImageFile.name
            : `nao-conformidade-${Date.now()}.jpg`,
      });
    } else {
      persistDraft(description, "", {
        cameraImageDataUrl: "",
        cameraImageFileName: "",
      });
    }
  }, [applyPreviewBlob, description, persistDraft]);

  const handleFileSelected = async (
    event: ChangeEvent<HTMLInputElement>,
    source: NonConformityImageSource,
  ) => {
    const file = event.target.files?.[0];
    captureFlowInProgressRef.current = false;

    if (!file) {
      return;
    }

    try {
      await applySelectedImage(file, source);
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

    // In some Android tablets the native capture flow opened by the file input
    // hides or omits the confirm action, so we confirm the photo inside the app.
    if (useInlineAndroidCamera) {
      captureFlowInProgressRef.current = false;
      revokeInlineCameraPreviewObjectUrl();
      setCapturedInlineCameraBlob(null);
      setCapturedInlineCameraPreviewUrl("");
      setInlineCameraError("");
      setInlineCameraOpen(true);
      return;
    }

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
    persistDraft(description, "", {
      cameraImageDataUrl: "",
      cameraImageFileName: "",
    });
  };

  const handleInlineCameraCapture = async () => {
    const video = inlineCameraVideoRef.current;

    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setInlineCameraError("A camera ainda esta inicializando. Aguarde um instante e tente capturar novamente.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Nao foi possivel preparar a foto capturada.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const capturedBlob = await canvasToJpegBlob(canvas, 0.92);
      setCapturedInlineCameraBlob(capturedBlob);
      applyInlineCameraPreviewBlob(capturedBlob);
      stopInlineCameraStream();
      setInlineCameraError("");
    } catch (error) {
      console.error("Error capturing inline Android camera image:", error);
      setInlineCameraError(
        error instanceof Error && error.message
          ? error.message
          : "Nao foi possivel capturar a foto tirada agora.",
      );
    }
  };

  const handleInlineCameraRetake = () => {
    setCapturedInlineCameraBlob(null);
    revokeInlineCameraPreviewObjectUrl();
    setCapturedInlineCameraPreviewUrl("");
    setInlineCameraError("");
    void startInlineCamera();
  };

  const handleInlineCameraConfirm = async () => {
    if (!capturedInlineCameraBlob) {
      return;
    }

    try {
      const capturedFile = new File(
        [capturedInlineCameraBlob],
        `nao-conformidade-${Date.now()}.jpg`,
        {
          type: "image/jpeg",
          lastModified: Date.now(),
        },
      );

      await applySelectedImage(capturedFile, "camera");
      resetInlineCameraState();
    } catch (error) {
      console.error("Error processing captured inline Android camera image:", error);
      toast({
        title: "Erro ao processar a imagem",
        description:
          error instanceof Error && error.message
            ? error.message
            : "Nao foi possivel preparar a foto para salvar a nao conformidade.",
        variant: "destructive",
      });
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isMobile && captureFlowInProgressRef.current) {
      return;
    }

    if (!nextOpen) {
      clearDraft();
      resetInlineCameraState();
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
                onChange={(event) => handleFileSelected(event, "camera")}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileSelected(event, "gallery")}
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

            {inlineCameraOpen ? (
              <div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50/80 p-3">
                <div className="overflow-hidden rounded-xl bg-neutral-950">
                  {capturedInlineCameraPreviewUrl ? (
                    <img
                      src={capturedInlineCameraPreviewUrl}
                      alt="Foto capturada"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <video
                      ref={inlineCameraVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="aspect-[4/3] w-full object-cover"
                    />
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  No Android, a confirmacao da foto acontece aqui dentro do sistema para evitar falhas do app nativo da camera.
                </p>

                {inlineCameraError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {inlineCameraError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={saving || loading || processingImage || startingInlineCamera}
                    onClick={resetInlineCameraState}
                  >
                    Cancelar
                  </Button>

                  {capturedInlineCameraPreviewUrl ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        disabled={saving || loading || processingImage}
                        onClick={handleInlineCameraRetake}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Tirar novamente
                      </Button>
                      <Button
                        type="button"
                        className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={saving || loading || processingImage}
                        onClick={handleInlineCameraConfirm}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Usar foto
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800"
                      disabled={saving || loading || processingImage || startingInlineCamera}
                      onClick={handleInlineCameraCapture}
                    >
                      {startingInlineCamera ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="mr-2 h-4 w-4" />
                      )}
                      {startingInlineCamera ? "Abrindo camera..." : "Capturar"}
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

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
                  resetInlineCameraState();
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
