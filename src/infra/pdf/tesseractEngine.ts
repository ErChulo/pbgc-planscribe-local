type OcrProgressEvent = {
  status?: string;
  progress?: number;
};

type TesseractWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data?: { text?: string } }>;
  terminate: () => Promise<unknown>;
};

type CreateWorkerFn = (
  langs?: string | string[],
  oem?: number,
  options?: { logger?: (event: OcrProgressEvent) => void },
  config?: unknown,
) => Promise<TesseractWorker>;

let workerPromise: Promise<TesseractWorker> | null = null;
let progressHandler: ((progress: number) => void) | null = null;

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

async function getCreateWorker(): Promise<CreateWorkerFn | null> {
  try {
    const module = await import("tesseract.js");
    if (typeof module.createWorker === "function") {
      return module.createWorker as unknown as CreateWorkerFn;
    }
    return null;
  } catch {
    return null;
  }
}

async function getWorker(): Promise<TesseractWorker | null> {
  if (workerPromise) {
    return workerPromise;
  }

  const createWorker = await getCreateWorker();
  if (!createWorker) {
    return null;
  }

  workerPromise = createWorker("eng", 1, {
    logger: (event) => {
      if (event.status === "recognizing text" && typeof event.progress === "number") {
        progressHandler?.(event.progress);
      }
    },
  });

  return workerPromise;
}

export async function recognizeCanvasText(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const worker = await getWorker();
  if (!worker) {
    return "";
  }

  progressHandler = onProgress ?? null;
  try {
    const result = await worker.recognize(canvas);
    return normalizeText(result.data?.text ?? "");
  } catch {
    return "";
  } finally {
    progressHandler = null;
  }
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) {
    return;
  }

  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}
