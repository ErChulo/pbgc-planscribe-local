import type { DocumentRecord, EmbeddingRecord, PageRecord } from "../types";
import type { StructuredExtraction, StructuredExtractionResult } from "./structured";

export interface AuditExportPackage {
  packageVersion: "1.0";
  generatedAt: string;
  extraction: StructuredExtraction;
  validationErrors: string[];
  warnings: string[];
  evidenceTrace: StructuredExtractionResult["fieldTraces"];
  corpusStats: {
    documentCount: number;
    pageCount: number;
    chunkCount: number;
    embeddingCount: number;
    ocrPageCount: number;
  };
}

export function buildAuditExportPackage(input: {
  extractionResult: StructuredExtractionResult;
  documents: DocumentRecord[];
  pages: PageRecord[];
  chunkCount: number;
  embeddings: EmbeddingRecord[];
}): AuditExportPackage {
  return {
    packageVersion: "1.0",
    generatedAt: new Date().toISOString(),
    extraction: input.extractionResult.extraction,
    validationErrors: input.extractionResult.validationErrors,
    warnings: input.extractionResult.warnings,
    evidenceTrace: input.extractionResult.fieldTraces,
    corpusStats: {
      documentCount: input.documents.length,
      pageCount: input.pages.length,
      chunkCount: input.chunkCount,
      embeddingCount: input.embeddings.length,
      ocrPageCount: input.pages.filter((page) => page.ocrApplied).length,
    },
  };
}
