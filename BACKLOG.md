# AdTech Flow — Development Backlog

Priority order: **P0** (Alpha blocker) → **P1** (Beta) → **P2** (v1.0) → **P3** (Post-launch)

Status labels: `📋 needs-grooming` | `✅ agent-ready` | `🔨 in-progress` | `🧪 in-review` | `✔️ done`

---

## Milestone 1 — Alpha (Target: 3 weeks) — ✅ COMPLETE

> **Validation note (2026-10-09):** this table was previously inaccurate. S-02 was
> marked complete although `tailwindcss` had never been installed — the build emitted a
> **0.24 kB** CSS bundle, so every Tailwind class rendered as nothing. M-01 was marked
> complete in `specs/001-ecosystem-map.md` although no React Flow canvas existed. All
> items below are now verified by executable checks; see `specs/alpha-milestone.md`.

### SETUP

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| S-01 | Scaffold Vite + React + TypeScript project in `frontend/` | P0 | ✔️ | `npm create vite@latest` |
| S-02 | Configure Tailwind CSS + shadcn/ui | P0 | ✔️ | Tailwind v4 via `@tailwindcss/vite`; `components.json` + `src/lib/utils.ts` + vendored primitives. **Verified: CSS 0.24 kB → 56 kB** |
| S-03 | Configure Oxlint (local) + ESLint (CI) hybrid linting | P0 | ✔️ | See `docs/linting.md`. `lint:deep` runs with `--max-warnings 0` |
| S-04 | Configure Vitest + React Testing Library | P0 | ✔️ | jsdom + globals + setup file; MSW booted with `onUnhandledRequest: 'error'` |
| S-05 | Set up Husky + lint-staged pre-commit hooks | P0 | ✔️ | Oxlint (fail-fast) → ESLint on staged files |
| S-06 | Set up GitHub Actions CI pipeline | P0 | ✔️ | Stage 1: Oxlint → 2: ESLint → 3: Vitest → 4: Typecheck & Build, plus a snapshot-reproducibility job |
| S-07 | Set up Zustand global store with auction state machine | P0 | ✔️ | IDLE → CONSENT_RESOLVED → … → AD_RENDERED (+ VERIFICATION_MEASURED). Deterministic; single rAF loop |
| S-08 | Set up MSW (Mock Service Worker) with mock SSP endpoints | P0 | ✔️ | Floor/timeout/consent/PMP enforced server-side; `204` when no bid qualifies. Fails loudly rather than leaking traffic |
| S-09 | Build-time `sellers.json` ETL script | P0 | ✔️ | Outputs `frontend/src/data/ecosystem-nodes.json` (< 400 KB); PII stripped; 60-node-per-source cap |

### ECOSYSTEM MAP (F-01)

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| M-01 | Render interactive React Flow canvas with curated ecosystem nodes | P0 | ✔️ | `EcosystemCanvas.tsx`; requires `@xyflow/react/dist/style.css` or edges silently fail to render |
| M-02 | Implement node card component with company name, category badge, and domain | P0 | ✔️ | `EcosystemNodeCard.tsx` — real `<button>`, `aria-label`, `aria-pressed` |
| M-03 | Implement node category colour coding (DSP/SSP/CMP/Identity/AdServer/Publisher) | P0 | ✔️ | Single source of truth in `lib/roleStyles.ts` |
| M-04 | Click node to open detail panel (role, seller type, domain, known integrations) | P0 | ✔️ | `NodeDetailSheet.tsx` — also surfaces the entity's live auction activity |
| M-05 | Category filter bar (toggle visibility by node type) | P1 | ✔️ | `CategoryFilterBar.tsx`; visual-only, never alters the auction outcome |
| M-06 | Category Stage Hubs with embedded dropdown buttons | P1 | ✔️ | `CategoryStageCard.tsx`; dropdown lists for DSP, Publishers, SSP, Ad Server, DMP, Identity (Option 1) |

### AUCTION SIMULATOR — ALPHA SLICE (F-02)

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| A-01 | Hardcoded demo auction with 3 mock demand partners (TTD, Magnite, OpenX) | P0 | ✔️ | TTD / DV360 / Amazon DSP via Magnite / PubMatic / OpenX. Engine is pure + deterministic (`auction/auction-engine.ts`) |
| A-02 | Auction playback controls: Play / Pause / Step Next / Step Back / Reset | P0 | ✔️ | Auto-pauses when the tab is hidden (rAF is suspended) |
| A-03 | Timeline slider with phase labels (0ms → 300ms) | P0 | ✔️ | Native `input[type=range]` → `role="slider"`, keyboard + `aria-valuetext` |
| A-04 | Animated bid packet edges on React Flow canvas (Framer Motion) | P0 | ✔️ | Path-sampled packet dots. Packets render for the current phase whether or not autoplay is running |
| A-05 | Winning bid display panel (winner badge, CPM value, bidder name) | P0 | ✔️ | `WinningBidPanel.tsx`; explains an empty auction rather than showing a stale winner |
| A-06 | Optional vendor toggles (Permutive SDA, Identity modules, IAS Measurement) | P0 | ✔️ | Toggles affect canvas nodes, timeline phases, and bid outcomes together |
| A-07 | IAS post-bid verification report card (Viewability, IVT rate, Brand Safety) | P1 | ✔️ | Shown only when IAS is enabled; metrics derived from the winning CPM |

---

## Milestone 2 — Beta (Target: +3 weeks)

### CONFIGURABLE AUCTION (F-03)

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| C-01 | Floor price slider (CPM $0–$10) with real-time bid rejection visual | P1 | 📋 | |
| C-02 | Bidder timeout control (50ms–3000ms) with timeout-out bidder animation | P1 | 📋 | |
| C-03 | TCF v2.2 consent toggle (all consented vs. consent withdrawn) | P1 | 📋 | Bidders drop when consent removed |
| C-04 | PMP Deal ID toggle (restrict auction to deal holders only) | P1 | 📋 | |
| C-05 | Artificial latency injection per mock bidder | P1 | 📋 | Slider per bidder node |

### OPENRTB INSPECTOR (F-04)

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| O-01 | Side panel showing OpenRTB 2.5 BidRequest JSON for selected step | P1 | 📋 | |
| O-02 | Side panel showing OpenRTB 2.5 BidResponse JSON | P1 | 📋 | |
| O-03 | Collapsible sections: `imp`, `site`, `user`, `regs`, `ext.prebid`, `seatbid` | P1 | 📋 | |
| O-04 | Zod schema validation badge (green = valid, red = invalid with error diff) | P1 | 📋 | |

### SHAREABLE URLS (F-06)

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| U-01 | Encode auction config in URL via `nuqs` | P1 | 📋 | `?floor=2.50&timeout=250&gdpr=1` |
| U-02 | "Copy Link" button to share current simulation state | P1 | 📋 | |

### ACCESSIBILITY — LIST VIEW (F-07)

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| ACC-01 | Toggle between canvas view and waterfall table/list view | P1 | 📋 | Table shows auction steps as rows |
| ACC-02 | Keyboard navigation for canvas nodes (Tab + Enter) | P1 | 📋 | |
| ACC-03 | ARIA labels on all interactive canvas elements | P1 | 📋 | |

---

## Milestone 3 — v1.0 (Target: +2 weeks)

### DEVELOPER SANDBOX (F-05)

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| D-01 | Monaco editor for `buyer.js` (`generateBid`) | P2 | ✔️ | |
| D-02 | Monaco editor for `seller.js` (`scoreAd`) | P2 | ✔️ | |
| D-03 | Live re-execution: editing scripts re-runs auction | P2 | ✔️ | |
| D-04 | Preset templates: First-Price, Second-Price, Floor-Aware, Deal-ID-Priority | P2 | ✔️ | |

### POLISH & LAUNCH

| ID | Title | Priority | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| P-01 | Storybook component documentation | P2 | 📋 | Document node cards, inspector panel, timeline slider |
| P-02 | Plausible Analytics integration (cookieless, GDPR-safe) | P2 | ✔️ | |
| P-03 | About modal with legal disclaimer and project description | P2 | ✔️ | |
| P-04 | Mobile-responsive layout (canvas → list view on small screens) | P2 | ✔️ | |
| P-05 | README and docs polish for open-source community launch | P2 | ✔️ | |
| P-06 | Prepare launch post for AdTech.dev / Prebid Slack / LinkedIn | P2 | ✔️ | |

---

## Post-Launch Backlog (P3)

| ID | Title | Notes |
| :--- | :--- | :--- |
| PL-01 | GAM arbitration panel — direct line item vs. programmatic priority visualisation | |
| PL-02 | Programmatic Guaranteed auction type toggle | |
| PL-03 | `schain` supply-path visualisation (hop-by-hop graph) | |
| PL-04 | Identity module simulation (ID5, SharedID, UID2.0) | |
| PL-05 | Prebid.js actual bundle integration (replace hardcoded mock with real Prebid) | |
| PL-06 | Saved simulation presets (export/import JSON config) | |
