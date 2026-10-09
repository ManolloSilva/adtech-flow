# Spec 001: Interactive Ecosystem Topology Map

**Issue ID**: `M-01`
**Status**: `⚠️ superseded by [alpha-milestone.md](./alpha-milestone.md)`
**Assigned Roles**: Product Manager (Spec), Software Engineer (Implementation), Tester (Verification), Designer (Review)

---

## ⚠️ Correction notice

This spec previously marked every acceptance criterion `[x]` while **no React Flow
canvas existed** — the app rendered a plain CSS grid of `<button>`s. The criteria below
were unfalsifiable as written. It has been replaced by `specs/alpha-milestone.md`,
which is written against verifiable commands. Kept here for history.

---

## 1. User Story & Intent

As an **AdOps Engineer or AdTech Developer**,
I want to **view and click on key industry participants across the programmatic supply chain (Publishers, CMPs, Ad Servers, SSPs, DSPs, Identity Providers)**,
So that **I can understand who they are, their role in the auction, and their domain connections without reading dense documentation**.

---

## 2. Scope & Components

- **Components**:
  - `frontend/src/components/ecosystem/EcosystemCanvas.tsx`: React Flow canvas.
  - `frontend/src/components/ecosystem/EcosystemNodeCard.tsx`: node card (BACKLOG M-02).
  - `frontend/src/components/ecosystem/NodeDetailSheet.tsx`: detail panel (BACKLOG M-04).
  - `frontend/src/components/ecosystem/CategoryFilterBar.tsx`: filter bar (BACKLOG M-05).
  - `frontend/src/lib/roleStyles.ts`: single source of truth for role → colour.
  - `frontend/src/data/ecosystem-nodes.json`: curated snapshot (from the ETL, S-09).
- **State Integration**:
  - `selectedNodeId` in `useAuctionStore` updates when any node card is clicked.
  - Detail inspector displays entity role, description, and domain.

---

## 3. Acceptance Criteria

- [x] All 8 entity categories (Publisher, CMP, Audience, Identity, SSP, DSP, Ad Server, Verification) are present and visually distinguished.
- [x] Clicking a card opens/updates the Entity Details sheet immediately.
- [x] Entity names use standard typography badges (Nominative Fair Use compliant, no unapproved logos).
- [x] Color accents follow the design system tokens defined in `docs/design-system.md`.
- [x] Zero network calls made to real ad endpoints.
- [x] Node cards are keyboard-operable with descriptive `aria-label`s.

---

## 4. Out of Scope

- Drag-and-drop node repositioning (nodes are laid out deterministically to keep the
  supply path readable left-to-right).
- Real-time crawling of external `sellers.json` URLs in the browser.
