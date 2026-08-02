export interface PdfPreviewRenderOptions {
  scale?: number;
  quality?: number;
  maxPages?: number;
  signal?: AbortSignal;
  onDocumentLoaded?: (pageCount: number) => void;
  onPageRendered?: (page: {
    imageUrl: string;
    pageCount: number;
    pageNumber: number;
  }) => void;
}

export interface PdfPreviewRenderResult {
  pageCount: number;
  images: string[];
}

export type PdfPreviewSource = string | Blob | ArrayBuffer | Uint8Array;

let workerSrcPromise: Promise<string> | null = null;
let renderQueue: Promise<void> = Promise.resolve();

const createAbortError = () =>
  new DOMException("A renderizacao do PDF foi cancelada.", "AbortError");

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw createAbortError();
  }
};

const canvasToImageUrl = async (
  canvas: HTMLCanvasElement,
  quality: number,
) => {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  return blob
    ? URL.createObjectURL(blob)
    : canvas.toDataURL("image/jpeg", quality);
};

export const releasePdfPreviewImages = (images: string[]) => {
  images.forEach((imageUrl) => {
    if (imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }
  });
};

const getPdfWorkerSrc = async () => {
  if (!workerSrcPromise) {
    workerSrcPromise = import(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"
    ).then((module) => module.default);
  }

  return workerSrcPromise;
};

const readPdfBytes = async (source: PdfPreviewSource) => {
  if (typeof source === "string") {
    const normalizedUrl = source.trim();

    if (!normalizedUrl) {
      return null;
    }

    const response = await fetch(normalizedUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar o PDF (${response.status}).`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }

  if (source instanceof Uint8Array) {
    return source;
  }

  return new Uint8Array(source);
};

const performPdfPreviewRender = async (
  source: PdfPreviewSource,
  options: PdfPreviewRenderOptions = {},
): Promise<PdfPreviewRenderResult> => {
  throwIfAborted(options.signal);
  const pdfBytes = await readPdfBytes(source);

  if (!pdfBytes || pdfBytes.byteLength === 0) {
    return {
      pageCount: 0,
      images: [],
    };
  }

  const [{ getDocument, GlobalWorkerOptions }, workerSrc] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    getPdfWorkerSrc(),
  ]);

  GlobalWorkerOptions.workerSrc = workerSrc;
  const loadingTask = getDocument({
    data: pdfBytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const images: string[] = [];

  try {
    throwIfAborted(options.signal);
    const quality = options.quality ?? 0.88;
    const scale = options.scale ?? 1.3;
    const maxPages =
      typeof options.maxPages === "number" && options.maxPages > 0
        ? Math.min(options.maxPages, pdf.numPages)
        : pdf.numPages;
    options.onDocumentLoaded?.(pdf.numPages);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      throwIfAborted(options.signal);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) {
        throw new Error("Nao foi possivel preparar o canvas do preview do PDF.");
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      const abortRender = () => renderTask.cancel();
      options.signal?.addEventListener("abort", abortRender, { once: true });

      try {
        await renderTask.promise;
      } finally {
        options.signal?.removeEventListener("abort", abortRender);
      }

      throwIfAborted(options.signal);
      const imageUrl = await canvasToImageUrl(canvas, quality);
      if (options.signal?.aborted) {
        releasePdfPreviewImages([imageUrl]);
        throw createAbortError();
      }
      images.push(imageUrl);
      options.onPageRendered?.({
        imageUrl,
        pageCount: pdf.numPages,
        pageNumber,
      });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }

    return {
      pageCount: pdf.numPages,
      images,
    };
  } catch (error) {
    releasePdfPreviewImages(images);
    throw error;
  } finally {
    await loadingTask.destroy();
  }
};

export const renderPdfPreviewImages = (
  source: PdfPreviewSource,
  options: PdfPreviewRenderOptions = {},
): Promise<PdfPreviewRenderResult> => {
  const renderJob = renderQueue.then(
    () => performPdfPreviewRender(source, options),
    () => performPdfPreviewRender(source, options),
  );

  renderQueue = renderJob.then(
    () => undefined,
    () => undefined,
  );

  return renderJob;
};
