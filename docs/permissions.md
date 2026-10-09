# Agent Permissions & Security Policy

This document defines the principle of least privilege applied to AI agents operating in the AdTech Flow repository.

---

## 1. Permission Matrix

| Agent | Read Code | Edit Code | Run Shell Commands | Commit / Push | Network Access |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Product Manager** | Full | `specs/`, `BACKLOG.md` | Read-only | No | None |
| **Software Engineer** | Full | `frontend/`, `backend/` | Sandbox commands (lint, test, build) | Only after approval | Local only (MSW) |
| **Tester** | Full | No | Sandbox commands (test, lint) | No | None |
| **On-Call Engineer**| Full | Targeted fix diffs | Diagnostic commands | No | None |
| **Designer** | Full | `docs/design-system.md` | No | No | None |

---

## 2. Hard Security Boundaries

1. **No Outbound Production Ad Traffic**: Agents must never configure or allow outbound HTTP requests to live DSP or SSP endpoints. All network activity must be mocked via `msw`.
2. **Commit Gatekeeper**: Software engineers are blocked from running `git commit` or `git push` directly until the Tester agent provides verifiable approval in the review transcript.
3. **PII Sanitization**: Any script that parses `sellers.json` or `ads.txt` must sanitize and strip email addresses and personal identity tokens prior to committing files.
