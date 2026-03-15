# Recommended First 10 GitHub Issues

## 1) Bootstrap React + Vite + Strict TypeScript
- Type: `chore`
- Outcome: working app scaffold with strict TS and scripts.
- Dependencies: none.

## 2) Add Repository Governance Templates
- Type: `chore`
- Outcome: PR template, issue templates, contribution guide.
- Dependencies: none.

## 3) Implement IndexedDB Repository Layer
- Type: `feat`
- Outcome: typed repositories for Document/Page/Chunk entities.
- Dependencies: #1.

## 4) Integrate PDF.js Local Extraction Service
- Type: `feat`
- Outcome: extract page text locally from imported PDFs.
- Dependencies: #1.

## 5) Build Text Normalization Module
- Type: `feat`
- Outcome: deterministic normalization for indexing/chunking.
- Dependencies: #4.

## 6) Implement Provision-Friendly Chunking with Unit Tests
- Type: `feat`
- Outcome: pure chunking logic with coverage and deterministic IDs.
- Dependencies: #5.

## 7) Persist Ingestion Artifacts to IndexedDB
- Type: `feat`
- Outcome: ingestion pipeline stores docs/pages/chunks reliably.
- Dependencies: #3, #4, #6.

## 8) Implement Lexical Index + Ranking with Unit Tests
- Type: `feat`
- Outcome: local lexical retrieval over chunks with ranking scores.
- Dependencies: #7.

## 9) Build Search + Citation UI
- Type: `feat`
- Outcome: query input, ranked results, and citation rendering.
- Dependencies: #8.

## 10) Add Integration Test: Import -> Search -> Inspect
- Type: `test`
- Outcome: end-to-end local MVP pipeline validation.
- Dependencies: #9.

## Suggested Labels
- `mvp`, `phase-1`, `privacy`, `infra`, `ui`, `test`, `docs`, `good-first-issue`

## Suggested Milestone
- `MVP - Local Ingestion and Lexical Retrieval`

