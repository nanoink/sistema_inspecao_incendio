export interface PdfPreviewRenderOptions {
  scale?: number;
  quality?: number;
  maxPages?: number;
}

export interface PdfPreviewRenderResult {
  pageCount: number;
  images: string[];
}

let workerSrcPromise: Promise<string> | null = null;

const getPdfWorkerSrc = async () => {
  if (!workerSrcPromise) {
    workerSrcPromise = import("pdfjs-dist/build/pdf.worker.min.mjs?url").then(
      (module) => module.default,
    );
  }

  return workerSrcPromise;
};

export const renderPdfPreviewImages = async (
  sourceUrl: string,
  options: PdfPreviewRenderOptions = {},
): Promise<PdfPreviewRenderResult> => {
  const normalizedUrl = sourceUrl.trim();

  if (!normalizedUrl) {
    return {
      pageCount: 0,
      images: [],
    };
  }

  const [{ getDocument, GlobalWorkerOptions }, workerSrc] = await Promise.all([
    import("pdfjs-dist/build/pdf.mjs"),
    getPdfWorkerSrc(),
  ]);

  GlobalWorkerOptions.workerSrc = workerSrc;

  const response = await fetch(normalizedUrl, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar o PDF (${response.status}).`);
  }

  const pdfBytes = await response.arrayBuffer();
  const pdf = await getDocument({
    data: pdfBytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

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
    pdf.destroy();
  }
};
