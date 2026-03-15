import type { Citation } from "../types";
import type { StructuredExtraction } from "../extraction/structured";

export interface RetrievalEvalCase {
  id: string;
  expectedCitation: Citation;
  rankedCitations: Citation[];
}

export interface RetrievalEvalMetrics {
  top1HitRate: number;
  top3HitRate: number;
  top5HitRate: number;
}

export function evaluateRetrieval(cases: RetrievalEvalCase[]): RetrievalEvalMetrics {
  if (cases.length === 0) {
    return { top1HitRate: 0, top3HitRate: 0, top5HitRate: 0 };
  }

  let top1 = 0;
  let top3 = 0;
  let top5 = 0;

  for (const testCase of cases) {
    const ranked = testCase.rankedCitations;
    const sameCitation = (candidate: Citation) =>
      candidate.documentId === testCase.expectedCitation.documentId &&
      candidate.page === testCase.expectedCitation.page &&
      candidate.chunkId === testCase.expectedCitation.chunkId;

    if (ranked[0] && sameCitation(ranked[0])) {
      top1 += 1;
    }
    if (ranked.slice(0, 3).some(sameCitation)) {
      top3 += 1;
    }
    if (ranked.slice(0, 5).some(sameCitation)) {
      top5 += 1;
    }
  }

  return {
    top1HitRate: top1 / cases.length,
    top3HitRate: top3 / cases.length,
    top5HitRate: top5 / cases.length,
  };
}

export interface ExtractionGoldCase {
  field: keyof StructuredExtraction["fields"];
  expectedValueContains: string;
}

export interface ExtractionEvalMetrics {
  precision: number;
  recall: number;
}

export function evaluateExtraction(
  extraction: StructuredExtraction,
  goldCases: ExtractionGoldCase[],
): ExtractionEvalMetrics {
  if (goldCases.length === 0) {
    return { precision: 0, recall: 0 };
  }

  let matches = 0;
  let predicted = 0;

  for (const [fieldName, fieldValue] of Object.entries(extraction.fields)) {
    if (fieldValue.value) {
      predicted += 1;
      const gold = goldCases.find((g) => g.field === fieldName);
      if (gold && fieldValue.value.toLowerCase().includes(gold.expectedValueContains.toLowerCase())) {
        matches += 1;
      }
    }
  }

  return {
    precision: predicted === 0 ? 0 : matches / predicted,
    recall: matches / goldCases.length,
  };
}
