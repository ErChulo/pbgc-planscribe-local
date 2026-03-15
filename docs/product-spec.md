# PlanScribe Local Product Specification

## 1) Product Summary
PlanScribe Local is a browser-only private document intelligence app for plan PDFs. It ingests local files, extracts text locally, indexes content locally, and supports evidence-based search and analysis with citations.

## 2) Target Users
- Actuarial and pension analysts reviewing plan provisions.
- Compliance and operations teams validating plan language.
- Internal reviewers needing citation-backed answers from plan documents.

## 3) Goals
- Enable fast local retrieval of relevant plan text with page-level evidence.
- Preserve strict privacy by keeping all sensitive data in-browser.
- Provide an extensible foundation for local QA and structured extraction.

## 4) Non-Goals (MVP)
- No OCR in MVP.
- No remote LLM calls.
- No multi-user collaboration backend.
- No enterprise identity integration.

## 5) Functional Requirements

### MVP (Phase 1)
- Import multiple local PDFs.
- Extract text locally via PDF.js.
- Capture page-aware text units.
- Chunk extracted text into provision-friendly segments.
- Persist documents/pages/chunks in IndexedDB.
- Run lexical search over chunks.
- Show results with citations and page inspection.
- Support document re-ingestion and deletion.

### Phase 2 (Local Embeddings + Hybrid Retrieval)
- Compute embeddings in-browser for chunks.
- Add vector index storage in IndexedDB.
- Hybrid retrieval: lexical + vector scoring fusion.
- Retrieval quality diagnostics (top-k evidence view).

### Phase 3 (Grounded QA)
- Local small LLM inference on retrieved context only.
- Answer generation constrained to cited snippets.
- Confidence and "insufficient evidence" behavior.

### Phase 4 (Structured Provision Extraction)
- JSON schema-based extraction from cited context.
- Field-level citations and validation status.
- Export JSON artifacts locally.

### Phase 5 (OCR Fallback)
- Local OCR for scanned PDFs.
- OCR confidence tracking and user warnings.

## 6) Data Model (Initial)
- `Document`: id, filename, import timestamp, hash, page count.
- `Page`: id, documentId, pageNumber, extractedText, extraction metadata.
- `Chunk`: id, documentId, pageStart/pageEnd, text, token estimate, offsets.
- `SearchIndexLexical`: chunkId + normalized terms metadata.
- `Embedding` (Phase 2): chunkId, vector, model version.

## 7) Key User Flows
- Import PDFs -> extraction status -> indexed and searchable.
- Search query -> ranked chunks -> open page with highlighted evidence.
- Inspect citation -> jump to document/page/chunk origin.
- Delete document -> remove all related local records.

## 8) Acceptance Criteria (MVP)
- Import 20+ medium PDFs without backend dependency.
- Search returns citations with document + page in all results.
- IndexedDB persistence survives page reload.
- No document text transmitted over network.
- Ingestion/search pipeline covered by integration tests.

## 9) NFRs
- Performance: first-search readiness for a 100-page PDF in practical local time.
- Reliability: resilient handling of malformed PDFs.
- Maintainability: strict TypeScript and modular boundaries.
- Auditability: traceable citation paths for all surfaced content.

## 10) Risks and Mitigations
- Browser memory pressure:
  - Mitigate via chunked ingestion and batched indexing.
- PDF extraction variance:
  - Mitigate via normalization and extraction diagnostics.
- Local model performance limits:
  - Mitigate via phased rollout and retrieval-first architecture.

