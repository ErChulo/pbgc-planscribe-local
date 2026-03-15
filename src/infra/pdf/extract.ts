import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ExtractedPage } from "../../domain/types";

GlobalWorkerOptions.workerSrc = workerSrc;

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

    pages.push({
      pageNumber,
      text: textItems.join(" "),
    });
  }

  return pages;
}

