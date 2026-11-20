# AdTech Flow — Product Specification

## 1. Problem Statement

Programmatic advertising is a multi-hundred-billion-dollar industry that processes trillions of monthly transactions. Despite its scale, the technical mechanics — header bidding auctions, OpenRTB protocol, consent strings, floor prices, supply-chain hops — remain opaque black boxes to most industry practitioners, developers, and learners.

**Current gaps:**
- Static educational materials (LumaScapes, slide decks) cannot demonstrate live behaviour.
- Professional tooling (Google Ad Manager, enterprise DSPs) requires enterprise contracts and media spend.
- No open-source, in-browser sandbox exists for safely experimenting with auction mechanics.

## 2. Vision

AdTech Flow is an **open-source, interactive, in-browser simulator** that makes the programmatic advertising ecosystem transparent, educational, and explorable — with zero media spend and zero backend setup.

## 3. Target Users

| Persona | Role | Use Case |
| :--- | :--- | :--- |
| AdOps Engineer | Publisher / Agency | Debug auction behaviour, understand why bids drop |
| AdTech Developer | SSP / DSP / Publisher tech | Test header bidding config, mock OpenRTB payloads |
| Digital Marketing Analyst | Agency / Brand | Understand CPM dynamics and supply chain |
| Student / Learner | University / Bootcamp | Learn programmatic concepts interactively |

## 4. Scope

### In Scope
- Open Auction RTB (Real-Time Bidding)
- Private Marketplace (PMP) with Deal IDs
- Programmatic Guaranteed & Preferred Deals
- GAM/Ad Server Arbitration (direct priority vs. programmatic)
- TCF v2.2 / GPP Consent Signal simulation
- SupplyChain Object (`schain`) transparency
- `sellers.json` ecosystem mapping (curated snapshot)
- First-party audience platform & Seller-Defined Audiences (Permutive)
- Optional vendor toggles (users can include/exclude Permutive, Identity, or other ecosystem modules)
- `buyer.js` (`generateBid`) and `seller.js` (`scoreAd`) simulation

### Out of Scope
- Traditional IO-based direct deals (no auction mechanics to simulate)
- Proprietary SDK/algorithm disclosures (standard industry tag simulation only)
- Live media spend or real ad serving
- Backend server infrastructure (100% in-browser for MVP)

## 5. Feature Inventory

### F-01: Ecosystem Map (Phase 1)
- Interactive node-graph canvas (React Flow) showing DSPs, SSPs, CMPs, Ad Servers, Identity Providers, Audience Platforms (Permutive), Verification Vendors (IAS), and Publishers
- Nodes sourced from a curated `sellers.json` ETL snapshot
- Click a node to see: role, seller type (PUBLISHER / INTERMEDIARY), domain, and known integrations
- Filter by category and toggle optional vendors in/out of the flow

### F-02: Animated Auction Simulator (Phase 1 Alpha)
- "Run Auction" button triggers animated bid packets flowing across the ecosystem canvas
- Step-by-step playback controls: Play / Pause / Step Next / Step Back / Reset
- Timeline slider (0ms → 300ms) with phase labels: Consent, ID Modules, Bid Requests, Timeout Cutoff, GAM, Ad Render
- A hardcoded demo auction with 3 mock demand partners runs on first load

### F-03: Configurable Auction Parameters (Phase 2)
- Floor price slider (e.g. `$0.00` to `$10.00 CPM`)
- Bidder timeout control (50ms to 3000ms)
- TCF v2.2 consent toggle (all vendors consented vs. consent withdrawn) — observing bidders drop when consent is removed
- PMP Deal ID toggle (restrict auction to deal holders only)
- Artificial latency injection per mock bidder (simulate timeout scenarios)

### F-04: OpenRTB Inspector Panel (Phase 2)
- Side panel showing the raw OpenRTB 2.5/3.0 JSON `BidRequest` and `BidResponse` for each step
- Collapsible sections: `imp`, `site`, `user`, `regs`, `ext.prebid`, `seatbid`
- Schema-validated against the IAB OpenRTB spec using Zod

### F-05: Developer Sandbox (Phase 3)
- Monaco code editor embedded in the browser for `buyer.js` (contains `generateBid()`)
- Monaco code editor for `seller.js` (contains `scoreAd()` and `reportResult()`)
- Live re-execution: editing the scripts re-runs the auction and updates the results panel
- Preset templates for common patterns: First-Price, Second-Price, Floor-Aware, Deal-ID-Priority

### F-06: Shareable Simulation URLs (Phase 2+)
- Simulation configuration encoded in URL query parameters via `nuqs`
- Example: `/?floor=2.50&timeout=250&gdpr=1&dsp=ttd,magnite&deal=DEAL-001`
- Shareable links to exact auction scenarios for debugging, education, and social sharing

### F-07: Accessibility — List/Waterfall View (Phase 2)
- Toggle between the visual canvas and a table/waterfall list view (similar to Chrome DevTools Network tab)
- Full keyboard navigability and WCAG 2.1 AA compliance

## 6. Architecture

### 6.1 Auction State Machine

The auction simulation is a deterministic state machine with the following steps:

```
[IDLE] → [CONSENT_RESOLVED] → [ID_MODULES_LOADED] → [BID_REQUESTS_FIRED]
→ [BIDS_COLLECTED] → [TIMEOUT_APPLIED] → [GAM_ARBITRATION] → [AD_RENDERED]
```

All UI components subscribe to the Zustand store. Playback controls increment/decrement the step index.

### 6.2 Network Layer

All bid network calls are intercepted by `msw` (Mock Service Worker). The browser developer tools show real HTTP requests to dummy SSP endpoints — providing an authentic DevTools experience without touching live ad servers.

### 6.3 sellers.json ETL

A build-time Node.js script (`scripts/fetch-sellers.ts`) runs at CI/CD time to:
1. Fetch `sellers.json` from top 10 SSPs
2. Strip PII (email addresses, personal contact fields)
3. Deduplicate intermediary domains
4. Tag each entity with category labels (DSP, SSP, CMP, Identity, Publisher)
5. Output a compact `frontend/src/data/ecosystem-nodes.json` (< 400 KB)

## 7. Legal & Compliance

- All company references are nominative fair use only — for educational identification purposes.
- No official brand logos are used; only text badges and standard icons.
- Prominent disclaimer displayed in app footer and About modal.
- Synthetic consent strings are watermarked and must not be used in real ad serving.
- All network calls are intercepted by MSW; no synthetic traffic reaches live ad endpoints.
- Sellers.json PII is stripped during the build-time ETL process.
- Licence: MIT.
