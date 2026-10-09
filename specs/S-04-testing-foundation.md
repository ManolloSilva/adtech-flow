# Spec: S-04 Configure Vitest + React Testing Library

**Issue ID**: `S-04`
**Status**: `✅ agent-ready`
**Assigned Roles**: Product Manager (Spec), Software Engineer (Implementation), Tester (Verification)

---

## 1. User Story & Intent

As a developer on AdTech Flow, I need a working unit/component test harness,
so that the deterministic auction state machine and the React Flow UI can be verified automatically
before every commit and in CI.

> **Context:** `vitest` is in `devDependencies` but there is **no test config, no setup file, and no tests**.
> CI Stage 3 (`npm run test:run`) therefore fails today.

---

## 2. Acceptance Criteria

- [ ] `vite.config.ts` (or `vitest.config.ts`) defines a `test` block with:
      `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`,
      `css: false`, and `restoreMocks: true`.
- [ ] `jsdom` and `@testing-library/jest-dom` are in `devDependencies` and resolvable.
- [ ] `src/test/setup.ts` imports `@testing-library/jest-dom/vitest` and calls
      `afterEach(() => cleanup())`.
- [ ] A **smoke test** exists that renders a real component (`App`) with React Testing Library and
      asserts on an accessible role/label — proving the harness end-to-end.
- [ ] `npm run test:run` exits `0`.
- [ ] `npm run test` (watch mode) still works for local development.
- [ ] `tsconfig.app.json` `include` covers `src` so test files are typechecked (no `noUnusedLocals` failures).

---

## 3. Component Scope and Data Model

- `src/test/setup.ts` — global test bootstrap.
- `src/test/smoke.test.tsx` — harness smoke test (temporary; superseded by real S-07/M-* tests).

---

## 4. Edge Cases & Out-of-Scope Items

- `Web Worker` globals (`Worker`, `self`) are unavailable in jsdom. Any auction-engine worker
  must be abstracted behind an injectable dependency so it can be faked in tests.
  → **Recorded as a hard constraint for S-07 / A-01.**
- MSW's service worker cannot register in jsdom. Tests must use MSW's `setupServer` (Node interceptor)
  rather than the browser worker. → **Hard constraint for S-08.**
- Out of scope: E2E/browser tests, coverage thresholds.

---

## 5. Tester Verification Commands

```bash
cd frontend
npm run test:run    # must exit 0 and report >= 1 passing test
```