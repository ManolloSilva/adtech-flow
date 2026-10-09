# System Architecture

AdTech Flow is an in-browser educational and developer simulator for programmatic advertising auctions.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Browser Client
        UI["React UI (React Flow Canvas + Inspector Panels)"]
        Store["Zustand Global State Store (Auction State Machine)"]
        Worker["Web Worker (Auction Engine / Prebid Logic)"]
        MSW["Mock Service Worker (Network Layer)"]
        Data["Curated sellers.json Snapshot (< 400KB)"]
    end

    UI <--> Store
    Store <--> Worker
    Worker -->|HTTP Fetch (Mocked)| MSW
    MSW -->|Synthetic OpenRTB 2.5/3.0 Response| Worker
    Data --> UI
```

---

## 1. Core Principles

1. **Zero Media Spend & Zero Infrastructure**: 100% of the auction executes client-side. No live DSP/SSP servers are ever contacted.
2. **Authentic Browser Network Layer**: By using **Mock Service Worker (MSW)**, synthetic bid requests (`/openrtb25/bid`) are intercepted at the Service Worker level. They appear directly in Chrome DevTools Network Tab as real HTTP POST requests.
3. **Deterministic State Machine**: Time-stepped playback (Consent $\to$ ID Sync $\to$ Bid Requests $\to$ Timeout Cutoff $\to$ GAM Arbitration $\to$ Render) runs through a single predictable state machine.
4. **URL Shareability**: Key simulation configurations (floor price, active bidders, consent flags) sync to URL query parameters via `nuqs` for instant sharing.

---

## 2. Key Modules

### A. Graph Canvas (`@xyflow/react`)
- Interactive canvas rendering nodes: **Publisher**, **CMP**, **Ad Server**, **SSPs**, **DSPs**, and **Identity Providers**.
- Custom node cards displaying company name, role, domain, and active status.
- Animated edge packets visualizing bid requests and bid responses traveling between nodes.
- **`@xyflow/react/dist/style.css` must be imported in `src/index.css`.** Without it
  React Flow's edge renderer silently produces nothing — nodes still appear, so the
  failure looks like a data bug rather than a missing stylesheet.
- `colorMode="dark"` is set explicitly; React Flow otherwise defaults to its light theme.

### B. State Management (`zustand`)
Single store (`frontend/src/store/auctionStore.ts`) managing:
- Current step index (0 to 6)
- Playback status (`idle`, `playing`, `paused`, `completed`)
- Configured parameters (`floorPrice`, `timeoutMs`, `gdprConsent`, `activeBidders`, `dealId`)
- Auction results (bids received, winning CPM, winning bidder)
- Selected node for inspection

### C. Auction Engine (`frontend/src/auction/auction-engine.ts`)
- **Pure and deterministic.** No `Math.random()`, no wall-clock reads, no I/O.
- Owns the phase schedule, packet generation, and the four rejection rules
  (consent → timeout → PMP deal → floor), applied in the order a real seller would.
- Derives every visible state from `(config, elapsedMs)`, so `stepBack` is exact and
  reproducible rather than an approximate rewind.
- **Not** run in a Web Worker yet: the Alpha slice computes synchronously in well under
  a millisecond. The module is deliberately side-effect free so it can be moved into a
  Worker without touching the store contract. (Original backlog note "Runs via Web
  Worker" is therefore deferred — flagged rather than silently dropped.)

### D. Network Layer (`msw`)
- Browser: Service Worker, so requests appear in Chrome DevTools as genuine HTTP POSTs.
- Tests: `setupServer` running the **same handlers**, so the two environments cannot drift.
- `onUnhandledRequest: 'error'` — an unhandled request fails the test rather than
  escaping to the network.
- Handlers enforce floor, timeout, consent, and PMP rules, returning `204 No Content`
  when no bid qualifies (OpenRTB 2.5-correct).
- `src/mocks/start.ts` blocks app rendering if the worker cannot start, so the app can
  never issue live ad-tech traffic.

### E. Build-Time sellers.json ETL (`scripts/fetch-sellers.ts`)
- Crawls top SSP public `sellers.json` files during project build/CI.
- Scrubs personal contact information (emails, names, phone numbers) to ensure privacy compliance.
- Deduplicates domains and indexes canonical entities into `frontend/src/data/ecosystem-nodes.json`.
- **Enforces a hard 400 KB budget** and fails loudly if exceeded. Live files hold
  3.2k–7.8k sellers each, so a 60-node-per-source cap keeps the output bounded.
- The committed snapshot is the deterministic curated seed; `--offline` output is
  byte-identical across runs, which is what CI asserts. Live enrichment is on demand
  (`npm run etl`) so CI stays reproducible.

---

## 3. Technology Stack Reference

- **UI Framework**: React 18, TypeScript, Vite
- **Canvas**: `@xyflow/react`
- **Network Interception**: `msw`
- **Component Primitives**: Tailwind CSS v4, `shadcn/ui`, `lucide-react`
- **Animation**: `framer-motion`
- **Code Editor**: `@monaco-editor/react`
- **Validation**: `zod`
- **Testing**: `vitest`, `@testing-library/react`
