import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ExtractedPage } from "../../domain/types";

GlobalWorkerOptions.workerSrc = workerSrc;

const MIN_DIRECT_TEXT_CHARS = 24;

export interface ExtractProgressEvent {
  pageNumber: number;
  totalPages: number;
  stage: "extracting_text" | "ocr_fallback";
  ocrProgress?: number;
}

export async function extractPdfPages(
  pdfData: ArrayBuffer,
  options: {
    onProgress?: (event: ExtractProgressEvent) => void;
  } = {},
): Promise<ExtractedPage[]> {
  const loadingTask = getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    options.onProgress?.({
      pageNumber,
      totalPages: pdf.numPages,
      stage: "extracting_text",
    });

    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const textItems = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    const directText = textItems.join(" ").replace(/\s+/g, " ").trim();

    let text = directText;
    let textSource: ExtractedPage["textSource"] = directText ? "pdf_text" : "empty";
    let ocrApplied = false;

    if (directText.length < MIN_DIRECT_TEXT_CHARS) {
      const { extractPageTextWithOcrFallback } = await import("./ocrFallback");
      const ocrText = await extractPageTextWithOcrFallback(page, (progress) => {
        options.onProgress?.({
          pageNumber,
          totalPages: pdf.numPages,
          stage: "ocr_fallback",
          ocrProgress: progress,
        });
      });
      if (ocrText) {
        text = ocrText;
        textSource = "ocr";
        ocrApplied = true;
      } else if (!directText) {
        textSource = "empty";
      }
    }

    pages.push({
      pageNumber,
      text,
      textSource,
      ocrApplied,
    });
  }

  return pages;
}

