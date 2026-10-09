# Spec: Alpha Milestone — Ecosystem Map & Auction Simulator

**Issue IDs**: `S-03` `S-05` `S-06` `S-07` `S-08` `S-09` `M-01`…`M-05` `A-01`…`A-07`
**Status**: `✅ agent-ready`
**Assigned Roles**: Product Manager (Spec + Acceptance), Software Engineer (Implementation), Tester (Verification), Designer (Design review)

---

## 1. Context — the backlog was inaccurate

The previous milestone state claimed S-01 and S-02 complete. Validation against the
repository showed **only S-01 was true**:

| Claimed | Reality found |
| :--- | :--- |
| S-02 ✅ Tailwind + shadcn/ui | `tailwindcss` was never installed; the build emitted a **0.24 kB** CSS bundle, so every Tailwind class in `App.tsx` rendered as nothing |
| M-01 📋 React Flow canvas | No React Flow at all — a plain CSS grid of `<button>`s |
| A-04 📋 Animated packets | No edges, no packets; `framer-motion` unused |
| A-03 📋 Timeline slider | A hardcoded `stepIndex * 35` label, not a slider |
| S-08 📋 MSW | Dependency present, zero handlers |
| S-09 📋 ETL script | Logged messages; fetched nothing and wrote no file |
| `specs/001-ecosystem-map.md` | Marked M-01 `[x]` although no canvas existed |

**Root cause:** everything was built on a foundation that emitted no CSS, so nothing
was ever visually verified, and specs were marked complete without a verification step.

---

## 2. Acceptance criteria — SETUP

### S-02 — Tailwind CSS v4 + shadcn/ui
- [x] `tailwindcss` + `@tailwindcss/vite` installed; plugin registered in `vite.config.ts`.
- [x] `src/index.css` uses the v4 entry (`@import 'tailwindcss'`) and an `@theme` block carrying the 8 role colours from `docs/design-system.md`.
- [x] `components.json` present and valid; `src/lib/utils.ts` exports `cn()`.
- [x] `@/*` alias declared in `vite.config.ts`, `tsconfig.app.json`, `tsconfig.node.json`.
- [x] shadcn/ui primitives vendored under `src/components/ui/`.
- [x] **Proof:** build CSS > 8 kB. *(Was 0.24 kB. Now 56 kB.)*
- [x] **React Flow stylesheet imported** — `@xyflow/react/dist/style.css`. Without it edges silently fail to render.

### S-03 — Oxlint + ESLint hybrid
- [x] `.oxlintrc.json` + `eslint.config.mjs` flat config.
- [x] `lint:fast` (`oxlint --deny-warnings`), `lint:deep` (`eslint . --max-warnings 0`), `lint:fix`, `test:coverage` scripts.
- [x] Accessibility rule requiring keyboard parity for interactive handlers.
- [x] `src/components/ui/**` exempted from `react-refresh` only (upstream shadcn convention), not globally.

### S-04 — Vitest + RTL
- [x] `test` block in `vite.config.ts`: `jsdom`, `globals`, setup file, `restoreMocks`, v8 coverage.
- [x] `src/test/setup.ts` polyfills `matchMedia`/`ResizeObserver`, boots MSW with `onUnhandledRequest: 'error'`.
- [x] 149 tests pass.

### S-05 — Husky + lint-staged
- [x] Hooks registered via `core.hooksPath = frontend/.husky` (git root has no `node_modules`).
- [x] `lint-staged` runs Oxlint **then** ESLint with `--fix --max-warnings 0` on staged `.ts/.tsx`.
- [x] Verified end-to-end against real staged files.

### S-06 — GitHub Actions
- [x] Four fail-fast stages: Oxlint → ESLint → Vitest → Typecheck & Build.
- [x] Verifies `dist/mockServiceWorker.js` ships (MSW must be served at root scope).
- [x] Fifth job asserts the ecosystem snapshot is reproducible.

### S-07 — Zustand store + state machine
- [x] Store owns timeline, playback, config, and derived results.
- [x] `IDLE → CONSENT_RESOLVED → … → AD_RENDERED (+ VERIFICATION_MEASURED)`.
- [x] Single rAF loop; **no `Math.random()`**, no wall-clock dependence → deterministic.
- [x] Any config change resets the simulation.
- [x] `reset()` clears *view* state (selection, category filters) as well as the timeline.

### S-08 — MSW
- [x] `POST /openrtb2/auction/:ssp` returns a synthetic OpenRTB 2.5 `BidResponse`.
- [x] Handlers enforce floor, timeout, consent, and PMP rules **server-side**, as a real seller would.
- [x] `204 No Content` when no bid qualifies (OpenRTB-correct).
- [x] `400` with path-qualified Zod issues for malformed requests.
- [x] Service Worker for the browser; `setupServer` for tests — same handlers, no drift.
- [x] `onUnhandledRequest: 'error'` fails loudly rather than letting traffic escape.
- [x] App refuses to render if the worker cannot start.

### S-09 — sellers.json ETL
- [x] Fetches, sanitises (PII stripped), normalises, merges, and emits `ecosystem-nodes.json`.
- [x] Injected network layer → fully offline-testable.
- [x] Enforces the < 400 KB budget and **fails loudly** when exceeded.
- [x] Per-source cap (60) — live files hold 3.2k–7.8k sellers and blew the budget 3×.
- [x] Curated seed always wins on id collision (human copy preserved).
- [x] 24 tests, including a guard that `DOMAIN_TO_ID` stays in sync with the seed.
- [x] `--offline` output is byte-deterministic, which is what CI asserts.

---

## 3. Acceptance criteria — ECOSYSTEM MAP

- [x] **M-01** Interactive React Flow canvas rendering all curated nodes at deterministic positions.
- [x] **M-02** Node card with company name, category badge, and domain.
- [x] **M-03** Category colour coding for all 8 roles, sourced from a single `ROLE_STYLES` map.
- [x] **M-04** Click opens a slide-out detail sheet: role, seller type, domain, known integrations, and live auction activity.
- [x] **M-05** Category filter bar toggling visibility per role.

---

## 4. Acceptance criteria — AUCTION SIMULATOR

- [x] **A-01** Hardcoded demo auction, 3 demand partners (TTD, DV360, Amazon DSP) via Magnite, PubMatic, OpenX.
- [x] **A-02** Play / Pause / Step Next / Step Back / Reset, with correct boundary disabling and a Replay affordance.
- [x] **A-03** Timeline slider spanning 0 → 300 ms with phase labels and `aria-valuetext`.
- [x] **A-04** Animated packets travel along canvas edges (Framer Motion, path-sampled).
- [x] **A-05** Winning-bid panel with winner badge, CPM, bidder, latency, and eligible count.
- [x] **A-06** Optional vendor toggles (Permutive, Identity, IAS) affecting nodes, phases, and bids simultaneously.
- [x] **A-07** IAS report card showing only when IAS is enabled, with metrics **derived** from the winning CPM.

---

## 5. Accessibility (WCAG 2.1 AA)

- [x] Node cards are real `<button>`s with descriptive `aria-label` and `aria-pressed`.
- [x] All sliders are native `input[type=range]` → `role="slider"`, arrow/Home/End keys, announced values.
- [x] Toggles are labelled Radix `Switch`/`Checkbox` controls.
- [x] Focus-visible ring mandated globally in `@layer base`.
- [x] Playback pauses when the tab is hidden (rAF is suspended, so playback would otherwise appear frozen).

---

## 6. Tester verification

```bash
cd frontend
npm run lint:fast && npm run lint:deep   # 0 warnings, 0 errors
npm run typecheck                        # 0 errors
npm run test:run                         # 149 passed
npm run build                            # CSS > 8 kB
cd .. && npm test                        # 24 passed (ETL)
npm run etl:offline                      # deterministic, < 400 KB
```

## 7. Known limitations (explicit, not silent)

1. **Automated visual check of edges/packets is blocked in this environment.** The
   automation browser tab is permanently `visibilityState: "hidden"`, which suspends
   `requestAnimationFrame`; React Flow's edge renderer and `fitView` are rAF-driven.
   A minimal 2-node/1-edge React Flow page also rendered zero edges there, proving the
   cause is environmental, not application code. Nodes, phases, bids, winner, and the
   IAS panel were all verified via the DOM.
2. **The committed ecosystem snapshot is the curated seed, not a live crawl.** Live
   `sellers.json` content changes upstream, which would make CI non-reproducible.
   `npm run etl` performs enrichment on demand.
3. **No E2E/browser test suite** — deferred to the Beta milestone alongside the
   waterfall/list view.