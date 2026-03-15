import { hybridSearch } from "../retrieval/hybrid";
import type { ChunkRecord, Citation, EmbeddingRecord, SearchResult } from "../types";

export interface ExtractedProvisionField {
  value: string | null;
  confidence: number;
  citation: Citation | null;
}

export interface StructuredExtraction {
  schemaVersion: "1.0";
  generatedAt: string;
  fields: {
    normalRetirementAge: ExtractedProvisionField;
    earlyRetirementReduction: ExtractedProvisionField;
    vestingSchedule: ExtractedProvisionField;
  };
}

export interface StructuredExtractionResult {
  extraction: StructuredExtraction;
  validationErrors: string[];
  supportingEvidence: SearchResult[];
}

function normalizeFieldValue(snippet: string): string {
  return snippet.replace(/\s+/g, " ").trim();
}

function pickField(
  query: string,
  chunks: ChunkRecord[],
  embeddings: EmbeddingRecord[],
): { field: ExtractedProvisionField; evidence: SearchResult[] } {
  const results = hybridSearch(query, chunks, embeddings, { limit: 3 });
  const best = results[0];
  if (!best) {
    return {
      field: {
        value: null,
        confidence: 0,
        citation: null,
      },
      evidence: [],
    };
  }

  return {
    field: {
      value: normalizeFieldValue(best.snippet),
      confidence: Number(best.score.toFixed(4)),
      citation: best.citation,
    },
    evidence: results,
  };
}

export function validateStructuredExtraction(extraction: StructuredExtraction): string[] {
  const errors: string[] = [];

  if (extraction.schemaVersion !== "1.0") {
    errors.push("schemaVersion must be 1.0");
  }

  const fields = extraction.fields;
  const fieldEntries = [
    ["normalRetirementAge", fields.normalRetirementAge] as const,
    ["earlyRetirementReduction", fields.earlyRetirementReduction] as const,
    ["vestingSchedule", fields.vestingSchedule] as const,
  ];

  for (const [name, field] of fieldEntries) {
    if (field.value && !field.citation) {
      errors.push(`${name} has value but missing citation`);
    }

    if (field.confidence < 0 || field.confidence > 1) {
      errors.push(`${name} confidence must be between 0 and 1`);
    }
  }

  return errors;
}

export function extractStructuredProvisions(
  chunks: ChunkRecord[],
  embeddings: EmbeddingRecord[],
): StructuredExtractionResult {
  const normalRetirement = pickField("normal retirement age", chunks, embeddings);
  const earlyRetirement = pickField("early retirement reduction", chunks, embeddings);
  const vesting = pickField("vesting schedule cliff graded vesting", chunks, embeddings);

  const extraction: StructuredExtraction = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    fields: {
      normalRetirementAge: normalRetirement.field,
      earlyRetirementReduction: earlyRetirement.field,
      vestingSchedule: vesting.field,
    },
  };

  const validationErrors = validateStructuredExtraction(extraction);
  const supportingEvidence = [...normalRetirement.evidence, ...earlyRetirement.evidence, ...vesting.evidence];

  return {
    extraction,
    validationErrors,
    supportingEvidence,
  };
}
