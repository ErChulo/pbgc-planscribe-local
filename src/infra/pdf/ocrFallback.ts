type RenderablePdfPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: { width: number; height: number };
  }) => { promise: Promise<unknown> };
};

interface TesseractLikeResult {
  data?: {
    text?: string;
  };
}

interface TesseractLike {
  recognize: (image: HTMLCanvasElement, language: string) => Promise<TesseractLikeResult>;
}

declare global {
  interface Window {
    Tesseract?: TesseractLike;
  }
}

function normalizeOcrText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function toRenderablePdfPage(page: unknown): RenderablePdfPage | null {
  if (!page || typeof page !== "object") {
    return null;
  }

  const candidate = page as {
    getViewport?: unknown;
    render?: unknown;
  };

  if (typeof candidate.getViewport !== "function" || typeof candidate.render !== "function") {
    return null;
  }

  return candidate as RenderablePdfPage;
}

export async function extractPageTextWithOcrFallback(page: unknown): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }

  const tesseract = window.Tesseract;
  if (!tesseract) {
    return "";
  }

  const renderablePage = toRenderablePdfPage(page);
  if (!renderablePage) {
    return "";
  }

  const viewport = renderablePage.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await renderablePage.render({ canvasContext: context, canvas, viewport }).promise;

  try {
    const result = await tesseract.recognize(canvas, "eng");
    return normalizeOcrText(result.data?.text ?? "");
  } catch {
    return "";
  }
}
