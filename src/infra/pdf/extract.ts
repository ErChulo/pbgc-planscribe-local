import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ExtractedPage } from "../../domain/types";

GlobalWorkerOptions.workerSrc = workerSrc;

const MIN_DIRECT_TEXT_CHARS = 24;

export async function extractPdfPages(pdfData: ArrayBuffer): Promise<ExtractedPage[]> {
  const loadingTask = getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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
      const ocrText = await extractPageTextWithOcrFallback(page);
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

