# PlanScribe Local Task Breakdown (Dependency Order)

## T0 Governance and Workflow
- T0.1 Add constitution and engineering rules.
- T0.2 Add PR template and issue templates.
- T0.3 Add branch naming and commit conventions doc.
- T0.4 Add CI for typecheck/lint/test.

## T1 Project Scaffold
- T1.1 Initialize React + Vite + TypeScript strict config.
- T1.2 Set up test tooling (unit + integration harness).
- T1.3 Establish module boundaries and folder layout.

## T2 Local Data Layer
- T2.1 Define domain entities (Document/Page/Chunk).
- T2.2 Implement IndexedDB repositories.
- T2.3 Add local migration/versioning support.

## T3 Ingestion Pipeline
- T3.1 Integrate PDF.js worker and extraction adapters.
- T3.2 Build text normalization utilities.
- T3.3 Persist extracted pages.

## T4 Chunking and Lexical Indexing
- T4.1 Implement chunking algorithm with tests.
- T4.2 Implement lexical index build/update.
- T4.3 Implement lexical ranking function with tests.

## T5 Search and Inspection UI
- T5.1 Import UI for multi-PDF selection and status.
- T5.2 Search UI with ranking results.
- T5.3 Citation panel (doc/page/chunk).
- T5.4 Document/page inspector.

## T6 Integration and Hardening
- T6.1 Integration test: import -> chunk -> index -> search.
- T6.2 Add malformed PDF handling and user-safe errors.
- T6.3 Add delete/re-index flows.

## T7 Privacy and Network Verification
- T7.1 Document runtime network expectations.
- T7.2 Add checks to ensure no outbound text transfer.
- T7.3 Document local data lifecycle controls.

## T8 Post-MVP Foundations
- T8.1 Embeddings architecture RFC.
- T8.2 Hybrid retrieval RFC.
- T8.3 Grounded QA and structured extraction RFC.

