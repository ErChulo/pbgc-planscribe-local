import { hybridSearch } from "../retrieval/hybrid";
import type { ChunkRecord, Citation, EmbeddingRecord, SearchResult } from "../types";
import type { NormalizedFieldValue } from "./parsers";
import {
  parseEarlyRetirementReduction,
  parseNormalRetirementAge,
  parseVestingSchedule,
} from "./parsers";

const MIN_CONFIDENCE = 0.35;

export interface ExtractedProvisionField {
  value: string | null;
  confidence: number;
  citation: Citation | null;
  status: "extracted" | "insufficient_evidence";
  reason?: string;
  normalized?: NormalizedFieldValue | null;
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
  fieldTraces: Array<{
    fieldName: keyof StructuredExtraction["fields"];
    query: string;
    evidence: SearchResult[];
  }>;
  warnings: string[];
}

function normalizeFieldValue(snippet: string): string {
  return snippet.replace(/\s+/g, " ").trim();
}

function pickField(
  fieldName: keyof StructuredExtraction["fields"],
  query: string,
  chunks: ChunkRecord[],
  embeddings: EmbeddingRecord[],
): { field: ExtractedProvisionField; evidence: SearchResult[]; warning?: string } {
  const results = hybridSearch(query, chunks, embeddings, { limit: 3 });
  const best = results[0];
  if (!best) {
    return {
      field: {
        value: null,
        confidence: 0,
        citation: null,
        status: "insufficient_evidence",
        reason: "No supporting evidence found.",
        normalized: null,
      },
      evidence: [],
      warning: `No evidence found for query: "${query}"`,
    };
  }

  const confidence = Number(best.score.toFixed(4));
  if (confidence < MIN_CONFIDENCE) {
    return {
      field: {
        value: null,
        confidence,
        citation: null,
        status: "insufficient_evidence",
        reason: `Top evidence score ${confidence} below threshold ${MIN_CONFIDENCE}.`,
        normalized: null,
      },
      evidence: results,
      warning: `Insufficient evidence confidence for query: "${query}"`,
    };
  }

  const value = normalizeFieldValue(best.snippet);
  const normalizedByField: Record<keyof StructuredExtraction["fields"], NormalizedFieldValue | null> = {
    normalRetirementAge: parseNormalRetirementAge(value),
    earlyRetirementReduction: parseEarlyRetirementReduction(value),
    vestingSchedule: parseVestingSchedule(value),
  };

  return {
    field: {
      value,
      confidence,
      citation: best.citation,
      status: "extracted",
      normalized: normalizedByField[fieldName],
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

    if (field.status === "extracted" && !field.value) {
      errors.push(`${name} marked extracted but has no value`);
    }

    if (field.status === "insufficient_evidence" && field.value) {
      errors.push(`${name} marked insufficient evidence but has a value`);
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
  const normalRetirement = pickField("normalRetirementAge", "normal retirement age", chunks, embeddings);
  const earlyRetirement = pickField("earlyRetirementReduction", "early retirement reduction", chunks, embeddings);
  const vesting = pickField("vestingSchedule", "vesting schedule cliff graded vesting", chunks, embeddings);
  const warnings = [normalRetirement.warning, earlyRetirement.warning, vesting.warning].filter(
    (warning): warning is string => Boolean(warning),
  );

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
  const fieldTraces: StructuredExtractionResult["fieldTraces"] = [
    {
      fieldName: "normalRetirementAge",
      query: "normal retirement age",
      evidence: normalRetirement.evidence,
    },
    {
      fieldName: "earlyRetirementReduction",
      query: "early retirement reduction",
      evidence: earlyRetirement.evidence,
    },
    {
      fieldName: "vestingSchedule",
      query: "vesting schedule cliff graded vesting",
      evidence: vesting.evidence,
    },
  ];

  return {
    extraction,
    validationErrors,
    supportingEvidence,
    fieldTraces,
    warnings,
  };
}
