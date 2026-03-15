# State Machines

## UI Async State

The app uses a coarse UI execution state (`idle` / `working`) for long-running operations.

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> working: import / extraction / restore / clear / delete
  working --> idle: success
  working --> idle: failure
```

## Extraction Field Status

Each extracted field transitions between confidence outcomes:

```mermaid
stateDiagram-v2
  [*] --> insufficient_evidence
  insufficient_evidence --> extracted: top evidence >= threshold
  extracted --> insufficient_evidence: evidence becomes weak/missing
```

## Backup Verification State

```mermaid
stateDiagram-v2
  [*] --> loaded
  loaded --> verified: SHA-256 matches manifest
  loaded --> rejected: hash mismatch or version mismatch
  verified --> restored: importWorkspaceSnapshot succeeds
  verified --> rejected: importWorkspaceSnapshot fails
```
