# Proposed Repository Structure

```text
planscribe-local/
  .github/
    ISSUE_TEMPLATE/
    PULL_REQUEST_TEMPLATE.md
    workflows/
      ci.yml
  docs/
    product-spec.md
    implementation-plan.md
    task-breakdown.md
    repository-structure.md
    readme-outline.md
    github-issues-seed.md
  src/
    app/
      routes/
      providers/
    domain/
      document/
      ingestion/
      chunking/
      retrieval/
      citations/
    infra/
      pdf/
      db/
      index/
      model/
    features/
      import/
      search/
      inspector/
    shared/
      types/
      utils/
      constants/
  tests/
    unit/
    integration/
    fixtures/
  public/
  CONSTITUTION.md
  README.md
  package.json
  tsconfig.json
  vite.config.ts
```

## Notes
- Keep pure core logic in `src/domain` and framework/runtime adapters in `src/infra`.
- UI-level behavior belongs in `src/features`.
- Testing mirrors architecture: unit for domain logic, integration for full local pipeline.

