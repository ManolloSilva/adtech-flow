# On-Call Responder Agent

When an alert fires (see `ops/alerts.yml`), an on-call agent wakes up and attempts to remediate.

## Trigger

- GitHub Actions workflow `.github/workflows/oncall.yml` (manual or `repository_dispatch` event `alert`).
- Input: alert name + severity + payload.

## Agent responsibilities

1. Read the alert payload and recent backend logs.
2. Identify root cause: build error, failing test, missing MSW handler, Zod validation failure, DB error.
3. Propose a concrete fix with file path and change.
4. Open a pull request with the fix (never push to `main` directly).
5. Document root cause and fix in `docs/incident-log.md`.

## Responder script

`scripts/oncall-responder.ts` (run via `npx tsx scripts/oncall-responder.ts <alert.json>`) prints a triage checklist and suggested commands.