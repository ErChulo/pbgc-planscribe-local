import { hybridSearch } from "../retrieval/hybrid";
import type { ChunkRecord, Citation, EmbeddingRecord, SearchResult } from "../types";
import type { NormalizedFieldValue } from "./parsers";
import {
  parseEarlyRetirementReduction,
  parseNormalRetirementAge,
  parseVestingSchedule,
} from "./parsers";

const MIN_CONFIDENCE = 0.35;
const DEFAULT_TEMPLATE_ID = "core-pension-v1" as const;

export type ExtractionTemplateId = "core-pension-v1" | "core-pension-v2";

interface FieldTemplate {
  fieldName: keyof StructuredExtraction["fields"];
  query: string;
}

interface ExtractionTemplate {
  id: ExtractionTemplateId;
  name: string;
  schemaVersion: string;
  fields: FieldTemplate[];
}

const EXTRACTION_TEMPLATES: Record<ExtractionTemplateId, ExtractionTemplate> = {
  "core-pension-v1": {
    id: "core-pension-v1",
    name: "Core Pension v1",
    schemaVersion: "1.0",
    fields: [
      { fieldName: "normalRetirementAge", query: "normal retirement age" },
      { fieldName: "earlyRetirementReduction", query: "early retirement reduction" },
      { fieldName: "vestingSchedule", query: "vesting schedule cliff graded vesting" },
    ],
  },
  "core-pension-v2": {
    id: "core-pension-v2",
    name: "Core Pension v2",
    schemaVersion: "1.1",
    fields: [
      { fieldName: "normalRetirementAge", query: "normal retirement date age unreduced retirement benefit" },
      { fieldName: "earlyRetirementReduction", query: "early retirement reduction actuarial reduction factors" },
      { fieldName: "vestingSchedule", query: "vesting schedule years of service cliff graded" },
    ],
  },
};

export interface ExtractedProvisionField {
  value: string | null;
  confidence: number;
  citation: Citation | null;
  status: "extracted" | "insufficient_evidence";
  reason?: string;
  normalized?: NormalizedFieldValue | null;
}

export interface StructuredExtraction {
  schemaVersion: string;
  templateId: ExtractionTemplateId;
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

export function listExtractionTemplates(): ExtractionTemplate[] {
  return Object.values(EXTRACTION_TEMPLATES);
}

function resolveTemplate(templateId?: ExtractionTemplateId): ExtractionTemplate {
  return EXTRACTION_TEMPLATES[templateId ?? DEFAULT_TEMPLATE_ID];
}

export function validateStructuredExtraction(extraction: StructuredExtraction): string[] {
  const errors: string[] = [];
  const template = EXTRACTION_TEMPLATES[extraction.templateId];

  if (!template) {
    errors.push(`templateId ${extraction.templateId} is not supported`);
  } else if (extraction.schemaVersion !== template.schemaVersion) {
    errors.push(
      `schemaVersion ${extraction.schemaVersion} does not match template ${template.id} (${template.schemaVersion})`,
    );
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
  options?: {
    templateId?: ExtractionTemplateId;
  },
): StructuredExtractionResult {
  const template = resolveTemplate(options?.templateId);
  const picks = template.fields.map((fieldTemplate) => ({
    ...fieldTemplate,
    picked: pickField(fieldTemplate.fieldName, fieldTemplate.query, chunks, embeddings),
  }));
  const warnings = picks.map((pick) => pick.picked.warning).filter(
    (warning): warning is string => Boolean(warning),
  );

  const fields = {
    normalRetirementAge: picks.find((pick) => pick.fieldName === "normalRetirementAge")!.picked.field,
    earlyRetirementReduction: picks.find((pick) => pick.fieldName === "earlyRetirementReduction")!.picked.field,
    vestingSchedule: picks.find((pick) => pick.fieldName === "vestingSchedule")!.picked.field,
  };

  const extraction: StructuredExtraction = {
    schemaVersion: template.schemaVersion,
    templateId: template.id,
    generatedAt: new Date().toISOString(),
    fields,
  };

  const validationErrors = validateStructuredExtraction(extraction);
  const supportingEvidence = picks.flatMap((pick) => pick.picked.evidence);
  const fieldTraces: StructuredExtractionResult["fieldTraces"] = picks.map((pick) => ({
    fieldName: pick.fieldName,
    query: pick.query,
    evidence: pick.picked.evidence,
  }));

  return {
    extraction,
    validationErrors,
    supportingEvidence,
    fieldTraces,
    warnings,
  };
}
