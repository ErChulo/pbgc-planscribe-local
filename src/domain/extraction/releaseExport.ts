import type { FieldReviewRecord } from "../types";

export interface ReleaseBundlePayload {
  bundleVersion: "1.0";
  generatedAt: string;
  workspaceId: string;
  runId: string;
  extraction: unknown;
  audit: unknown;
  reviews: FieldReviewRecord[];
  metadata: {
    validationErrorCount: number;
    warningCount: number;
  };
}

export interface SignedReleaseManifest {
  manifestVersion: "1.0";
  generatedAt: string;
  hashes: {
    bundleSha256: string;
    reviewCsvSha256: string;
  };
  bytes: {
    bundleJson: number;
    reviewCsv: number;
  };
}

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
  const next: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    next[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return next;
}

function toCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function bytesLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hash;
}

export function buildFieldReviewCsv(reviews: FieldReviewRecord[]): string {
  const header = [
    "id",
    "workspaceId",
    "extractionRunId",
    "fieldName",
    "action",
    "reviewerNote",
    "editedValue",
    "createdAt",
  ];
  const lines = [header.join(",")];

  for (const review of reviews) {
    const row = [
      review.id,
      review.workspaceId,
      review.extractionRunId,
      review.fieldName,
      review.action,
      review.reviewerNote,
      review.editedValue ?? "",
      review.createdAt,
    ].map((value) => escapeCsvValue(value));
    lines.push(row.join(","));
  }

  return `${lines.join("\n")}\n`;
}

export async function buildSignedReleaseManifest(input: {
  bundle: ReleaseBundlePayload;
  reviewCsv: string;
}): Promise<SignedReleaseManifest> {
  const canonicalBundle = toCanonicalJson(input.bundle);
  const bundleSha256 = await sha256Hex(canonicalBundle);
  const reviewCsvSha256 = await sha256Hex(input.reviewCsv);

  return {
    manifestVersion: "1.0",
    generatedAt: new Date().toISOString(),
    hashes: {
      bundleSha256,
      reviewCsvSha256,
    },
    bytes: {
      bundleJson: bytesLength(canonicalBundle),
      reviewCsv: bytesLength(input.reviewCsv),
    },
  };
}
