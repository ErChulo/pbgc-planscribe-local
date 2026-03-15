# PlanScribe Local Implementation Plan (Initial)

## Phase 0: Repository Foundation
- Establish governance docs and workflow rules.
- Scaffold React + Vite + strict TypeScript baseline.
- Configure linting, formatting, and test framework.
- Define PR template, issue templates, and CI checks.

## Phase 1: MVP Ingestion + Lexical Retrieval
1. Build local PDF ingestion service using PDF.js.
2. Implement page text normalization pipeline.
3. Implement chunking module with deterministic chunk IDs.
4. Persist documents/pages/chunks in IndexedDB repository layer.
5. Add lexical indexing and ranking utilities.
6. Build search UI with result list and citation display.
7. Build document/page inspector view.
8. Add integration tests for import -> index -> search flow.

## Phase 2: Local Embeddings + Hybrid Retrieval
1. Select browser-compatible embedding model/runtime.
2. Implement embedding computation worker pipeline.
3. Persist vectors in IndexedDB with model versioning.
4. Implement hybrid scoring and retrieval tuning hooks.
5. Add retrieval quality tests and benchmarks.

## Phase 3: Grounded QA
1. Add local LLM runtime integration with strict context limits.
2. Build prompt assembly from top cited chunks only.
3. Implement answer + citation packaging.
4. Add "cannot answer from evidence" fallback behavior.
5. Test groundedness and citation completeness.

## Phase 4: Structured JSON Extraction
1. Define extraction schema catalog for plan provisions.
2. Build schema-driven extraction pipeline.
3. Add field-level citation mapping.
4. Add JSON validation + export.

## Phase 5: OCR Fallback
1. Introduce local OCR ingestion path for scanned PDFs.
2. Merge OCR output into existing chunk/index pipeline.
3. Surface OCR confidence and warnings in UI.

## Release Strategy
- Ship MVP as first tagged release.
- Gate later phases behind feature flags.
- Maintain migration scripts for IndexedDB schema upgrades.

