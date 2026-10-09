# AdTech Flow

> An open-source, interactive, in-browser simulator for the programmatic advertising ecosystem.

AdTech Flow demystifies the "black box" of programmatic advertising by letting you visualise, step through, and configure real-time bidding auctions — without spending a single media dollar.

---

## The Problem

Programmatic advertising processes trillions of monthly transactions, yet the mechanics — header bidding, OpenRTB, consent signals, floor prices, supply-chain hops — remain opaque to most practitioners, developers, and learners in the industry. Existing educational material is static. Professional tooling requires enterprise contracts. There is no safe sandbox to experiment.

## What AdTech Flow Does

- **Interactive Ecosystem Map** — Explore the programmatic supply chain as a live node graph: Publishers, CMPs, SSPs, DSPs, Ad Servers, and Identity providers, seeded from real `sellers.json` data.
- **Animated Auction Simulator** — Step through a full RTB auction in slow motion: consent resolution → bid requests → competing DSPs → floor enforcement → GAM arbitration → ad render.
- **Configurable Parameters** — Toggle GDPR consent, adjust floor prices, inject artificial latency, and enable/disable PMP deal IDs. Watch the auction change in real time.
- **Developer Sandbox** — Edit `buyer.js` (`generateBid`) and `seller.js` (`scoreAd`) live in the browser with a Monaco editor and see the auction results change immediately.
- **OpenRTB Inspector** — Inspect full OpenRTB 2.5/3.0 request and response payloads at every step of the auction.

## Scope

AdTech Flow covers **programmatic advertising** and its derivatives:

| Included | Excluded |
| :--- | :--- |
| Open Auction (RTB) | Traditional IO-based Direct Deals |
| Private Marketplace (PMP) / Deal IDs | |
| Programmatic Guaranteed & Preferred Deals | |
| GAM Arbitration (direct line item vs. programmatic) | |
| TCF v2.2 / GPP Consent Signals | |
| Supply-Chain (`schain`) Transparency | |

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| Framework | React 18 + Vite + TypeScript |
| Graph Canvas | `@xyflow/react` (React Flow) |
| Auction Engine | `prebid.js` (custom mock adapters) |
| Network Mocking | `msw` (Mock Service Worker) |
| State Management | `zustand` |
| URL State | `nuqs` |
| UI Primitives | `shadcn/ui` + `tailwindcss` |
| Code Editor | `@monaco-editor/react` |
| Validation | `zod` |
| Animation | `framer-motion` |
| Linting | Oxlint (local/pre-commit) + ESLint (CI) |
| Testing | Vitest + React Testing Library |

## Project Structure

```text
adtech-flow/
├── README.md                  # This file
├── product-spec.md            # Full product specification
├── AGENTS.md                  # Agent team definitions and workflow
├── BACKLOG.md                 # Prioritised development backlog
├── frontend/                  # React + Vite application
├── backend/                   # (Reserved) Lightweight mock server for Phase 3+
├── openapi.yaml               # API specification
├── docker-compose.yml         # Local development orchestration
├── .github/
│   └── workflows/             # CI/CD pipelines
├── docs/                      # Architecture decisions, design notes
├── security/                  # Security audit notes, IVT prevention docs
├── ops/                       # Deployment and infrastructure
├── agent-capabilities/        # Agent extension pack
├── agent-hooks/               # Lifecycle hooks
├── specs/                     # Feature specifications
└── scripts/                   # Build-time utilities (ETL, sellers.json snapshot)
```

## AI-Assisted Development Workflow

This project is built using an AI agent team (see [AGENTS.md](./AGENTS.md)). The workflow follows the pattern from [AI Shipping Labs](https://github.com/AI-Shipping-Labs/website/tree/main/.claude/agents):

1. **Product Manager Agent** — Grooms raw issues into agent-ready specs and performs final user-perspective acceptance review.
2. **Software Engineer Agent** — Implements issues from specs. Does not commit until tester approves.
3. **Tester Agent** — Reviews uncommitted work against acceptance criteria. Approves before commit.
4. **On-Call Engineer Agent** — Investigates runtime errors, failed CI, and unexpected behaviour.
5. **Designer Agent** — Owns UI/UX decisions, component design, and visual consistency.

All agent definitions are in [AGENTS.md](./AGENTS.md) and are written to be **agent-agnostic** — compatible with any AI coding assistant that supports a context/system-prompt file.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/<your-username>/adtech-flow.git
cd adtech-flow/frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

## Roadmap

| Milestone | Focus | Target |
| :--- | :--- | :--- |
| **Alpha** | Interactive Ecosystem Map + hardcoded demo auction |
| **Beta** | Configurable auction (floors, consent, latency, PMP) + OpenRTB inspector
| **v1.0** | Monaco editor sandbox + shareable URLs + Storybook docs + community launch

## Legal

All company names, brand names, and trademarks referenced in this project (including but not limited to Google, The Trade Desk, Magnite, PubMatic, Index Exchange, LiveRamp, and others) are the property of their respective owners. Their reference in this project is strictly for **nominative, educational, and descriptive purposes** under the doctrine of Nominative Fair Use and does not imply any affiliation, sponsorship, or endorsement.

Ecosystem data is sourced from publicly available `sellers.json` and `ads.txt` files, which are IAB Tech Lab-mandated transparency files. Personal contact information is stripped during the offline ingestion process.

## Licence

[MIT](./LICENSE)
