export interface PdfPreviewRenderOptions {
  scale?: number;
  quality?: number;
  maxPages?: number;
}

export interface PdfPreviewRenderResult {
  pageCount: number;
  images: string[];
}

export type PdfPreviewSource = string | Blob | ArrayBuffer | Uint8Array;

let workerSrcPromise: Promise<string> | null = null;

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

export const renderPdfPreviewImages = async (
  source: PdfPreviewSource,
  options: PdfPreviewRenderOptions = {},
): Promise<PdfPreviewRenderResult> => {
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

  try {
    const quality = options.quality ?? 0.88;
    const scale = options.scale ?? 1.3;
    const maxPages =
      typeof options.maxPages === "number" && options.maxPages > 0
        ? Math.min(options.maxPages, pdf.numPages)
        : pdf.numPages;
    const images: string[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) {
        throw new Error("Nao foi possivel preparar o canvas do preview do PDF.");
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      images.push(canvas.toDataURL("image/jpeg", quality));
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }

    return {
      pageCount: pdf.numPages,
      images,
    };
  } finally {
    await loadingTask.destroy();
  }
};
