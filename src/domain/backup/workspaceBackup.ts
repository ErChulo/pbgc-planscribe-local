import type {
  ChunkRecord,
  DocumentRecord,
  EmbeddingRecord,
  ExtractionRunRecord,
  FieldReviewRecord,
  PageRecord,
  WorkspaceRecord,
} from "../types";

export interface WorkspaceSnapshot {
  snapshotVersion: "1.0";
  generatedAt: string;
  workspace: WorkspaceRecord;
  documents: DocumentRecord[];
  pages: PageRecord[];
  chunks: ChunkRecord[];
  embeddings: EmbeddingRecord[];
  extractionRuns: ExtractionRunRecord[];
  fieldReviews: FieldReviewRecord[];
}

export interface WorkspaceSnapshotManifest {
  manifestVersion: "1.0";
  generatedAt: string;
  workspaceId: string;
  snapshotSha256: string;
  recordCounts: {
    documents: number;
    pages: number;
    chunks: number;
    embeddings: number;
    extractionRuns: number;
    fieldReviews: number;
  };
}

export interface WorkspaceBackupEnvelope {
  envelopeVersion: "1.0";
  generatedAt: string;
  snapshot: WorkspaceSnapshot;
  manifest: WorkspaceSnapshotManifest;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const sorted = Object.keys(value as Record<string, unknown>).sort();
  const next: Record<string, unknown> = {};
  for (const key of sorted) {
    next[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return next;
}

function toCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildWorkspaceSnapshotManifest(
  snapshot: WorkspaceSnapshot,
): Promise<WorkspaceSnapshotManifest> {
  const snapshotSha256 = await sha256Hex(toCanonicalJson(snapshot));
  return {
    manifestVersion: "1.0",
    generatedAt: new Date().toISOString(),
    workspaceId: snapshot.workspace.id,
    snapshotSha256,
    recordCounts: {
      documents: snapshot.documents.length,
      pages: snapshot.pages.length,
      chunks: snapshot.chunks.length,
      embeddings: snapshot.embeddings.length,
      extractionRuns: snapshot.extractionRuns.length,
      fieldReviews: snapshot.fieldReviews.length,
    },
  };
}

export async function buildWorkspaceBackupEnvelope(
  snapshot: WorkspaceSnapshot,
): Promise<WorkspaceBackupEnvelope> {
  return {
    envelopeVersion: "1.0",
    generatedAt: new Date().toISOString(),
    snapshot,
    manifest: await buildWorkspaceSnapshotManifest(snapshot),
  };
}

export async function verifyWorkspaceBackupEnvelope(
  envelope: WorkspaceBackupEnvelope,
): Promise<{ valid: boolean; reason?: string }> {
  if (envelope.envelopeVersion !== "1.0") {
    return { valid: false, reason: "Unsupported envelopeVersion." };
  }
  if (envelope.snapshot.snapshotVersion !== "1.0") {
    return { valid: false, reason: "Unsupported snapshotVersion." };
  }
  if (envelope.manifest.workspaceId !== envelope.snapshot.workspace.id) {
    return { valid: false, reason: "Manifest workspaceId does not match snapshot workspace id." };
  }

  const expected = await sha256Hex(toCanonicalJson(envelope.snapshot));
  if (expected !== envelope.manifest.snapshotSha256) {
    return { valid: false, reason: "Snapshot hash mismatch. Backup may be corrupted or modified." };
  }

  return { valid: true };
}
