import { createChunks } from "../../domain/chunking/chunker";
import { buildChunkEmbeddings } from "../../domain/embeddings/localEmbedder";
import { normalizeText } from "../../domain/text/normalize";
import type { DocumentRecord, PageRecord } from "../../domain/types";
import { PlanScribeDb } from "../../infra/db/indexedDb";
import type { ExtractedPage } from "../../domain/types";

export class DuplicateDocumentError extends Error {
  readonly existingDocument: DocumentRecord;

  constructor(existingDocument: DocumentRecord) {
    super(`Duplicate document: ${existingDocument.filename}`);
    this.name = "DuplicateDocumentError";
    this.existingDocument = existingDocument;
  }
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export interface IngestionSummary {
  document: DocumentRecord;
  pageCount: number;
  chunkCount: number;
}

export function buildIngestionArtifacts(input: {
  documentId: string;
  filename: string;
  sha256: string;
  extractedPages: ExtractedPage[];
  importedAt?: string;
}): { document: DocumentRecord; pages: PageRecord[]; chunkCount: number } {
  const document: DocumentRecord = {
    id: input.documentId,
    filename: input.filename,
    sha256: input.sha256,
    importedAt: input.importedAt ?? new Date().toISOString(),
    pageCount: input.extractedPages.length,
  };

  const pages: PageRecord[] = input.extractedPages.map((page) => ({
    id: `${input.documentId}-page-${page.pageNumber}`,
    documentId: input.documentId,
    pageNumber: page.pageNumber,
    text: normalizeText(page.text),
  }));

  const chunks = createChunks(
    input.documentId,
    pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text,
    })),
  );

  return { document, pages, chunkCount: chunks.length };
}

export async function ingestPdfFile(
  db: PlanScribeDb,
  file: File,
): Promise<IngestionSummary> {
  const { extractPdfPages } = await import("../../infra/pdf/extract");
  const fileBuffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(fileBuffer);
  const existingDocument = await db.findDocumentBySha256(sha256);
  if (existingDocument) {
    throw new DuplicateDocumentError(existingDocument);
  }
  const extractedPages = await extractPdfPages(fileBuffer);

  const documentId = crypto.randomUUID();
  const { document, pages, chunkCount } = buildIngestionArtifacts({
    documentId,
    filename: file.name,
    sha256,
    extractedPages,
  });

  const chunks = createChunks(
    document.id,
    pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text,
    })),
  );
  const embeddings = buildChunkEmbeddings(chunks);

  await db.putDocumentGraph(document, pages, chunks, embeddings);

  return {
    document,
    pageCount: pages.length,
    chunkCount,
  };
}
