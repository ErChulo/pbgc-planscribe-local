export interface DocumentRecord {
  id: string;
  filename: string;
  sha256: string;
  importedAt: string;
  pageCount: number;
}

export interface PageRecord {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  textSource?: "pdf_text" | "ocr" | "empty";
  ocrApplied?: boolean;
}

export interface ChunkRecord {
  id: string;
  documentId: string;
  pageStart: number;
  pageEnd: number;
  text: string;
}

export interface EmbeddingRecord {
  id: string;
  chunkId: string;
  documentId: string;
  dimensions: number;
  model: string;
  vector: number[];
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  textSource?: "pdf_text" | "ocr" | "empty";
  ocrApplied?: boolean;
}

export interface Citation {
  documentId: string;
  page: number;
  chunkId: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  score: number;
  snippet: string;
  citation: Citation;
  lexicalScore?: number;
  vectorScore?: number;
}

export interface ExtractionRunRecord {
  id: string;
  createdAt: string;
  documentIds: string[];
  extractionJson: string;
  auditJson: string;
  validationErrorCount: number;
  warningCount: number;
}

