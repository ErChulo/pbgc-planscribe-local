# PlanScribe Local Constitution

## 1) Purpose
PlanScribe Local exists to provide private, browser-only analysis of pension plan PDFs with citations and structured extraction support, without sending document content to remote services.

## 2) Non-Negotiable Constraints
- No backend services for ingestion, retrieval, or generation.
- No remote APIs for document text, embeddings, or prompts.
- No hidden telemetry, analytics, or cloud fallback.
- End-user runtime is a browser only (no required desktop install).
- PDF content, extracted text, chunks, embeddings, prompts, and outputs stay local.

## 3) Engineering Principles
- TypeScript-first, strict mode enabled.
- Modular architecture with clear boundaries:
  - `ingestion` (PDF import/extraction)
  - `indexing` (chunking/storage/embeddings)
  - `retrieval` (lexical/hybrid search)
  - `qa` (grounded answer/extraction with citations)
  - `ui` (React presentation layer)
- Prefer pure functions for core ranking/chunking logic.
- Every stage must be testable and auditable.
- Privacy and network behavior must be explicitly documented.

## 4) Quality Gates
- Lint, typecheck, and tests must pass before merge.
- Critical logic requires unit tests:
  - chunking
  - lexical ranking
  - citation construction
- Integration tests required for ingestion and local search path.
- New behavior must include docs updates.

## 5) Citation Integrity
- Any answer or extracted field must include source references:
  - document identifier
  - page number
  - chunk identifier
- UI must provide an inspectable citation trail.

## 6) Security and Privacy
- Default-deny outbound network from app runtime where practical.
- Dependency selection favors permissive licenses and minimal data risk.
- Data persistence uses IndexedDB only.
- Clear data lifecycle controls (import, re-index, delete-all local data).

## 7) Git and GitHub Workflow
- Trunk branch: `main` (protected).
- All work on feature branches.
- Conventional Commits required.
- Commits must be atomic and scoped.
- Pull requests must include:
  - purpose
  - testing evidence
  - privacy/network impact
  - screenshots for UI changes
- No large unrelated changes in a single PR.

## 8) Definition of Done
A change is done when:
- acceptance criteria are met,
- tests and quality checks pass,
- documentation is updated,
- privacy/citation requirements remain satisfied,
- PR review requirements are complete.

