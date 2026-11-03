# Spec: M-06 Category Stage Hubs with Dropdown Selectors

**Issue ID**: `M-06`
**Status**: `✅ agent-ready`
**Assigned Roles**: Product Manager (Spec + Acceptance), Software Engineer (Implementation), Tester (Verification), Designer (Design review)

---

## 1. User Story & Intent

As an **AdOps Engineer, Developer, or Learner**,
I want **the ecosystem canvas to display clean, high-level category stage cards (Publishers, CMP, SSP, DSP, Ad Server, DMP/Audience, Identity, Verification) with embedded dropdown buttons**,
So that **I can clearly understand the end-to-end programmatic auction flow without visual clutter or crisscrossing lines, while still being able to browse, select, and inspect any individual company from sellers.json**.

---

## 2. Background & Problem Statement

In the Alpha milestone, all 28 curated companies from `sellers.json` were rendered simultaneously as static cards on the canvas. With 9 SSPs and 7 DSPs stacked in adjacent columns, the canvas became dense with overlapping lines ("spaghetti canvas"), even though only 3 demand partners actively participate in the auction simulation.

Users requested a **drop-down button architecture** for the ecosystem (Option 1):
Instead of 28 static cards competing for screen real estate, each stage of the supply chain is represented by a category hub card with an embedded dropdown button containing all member companies.

---

## 3. Scope & Components

### 3.1 New & Updated Components
- **`frontend/src/components/ecosystem/CategoryStageCard.tsx`** (New):
  - Custom React Flow node representing an ecosystem category stage.
  - Displays category badge with role styling (`roleStyles.ts`).
  - Total vendor count badge (e.g. `9 vendors`, `7 vendors`).
  - Embedded dropdown selector (`nodrag nopan`) showing the currently selected/active vendor name with a chevron icon (`▼`).
  - Dropdown menu reveals all member companies in that category with domain, seller type, and active bid status (`Winner`, `Timed out`, `Below floor`, `No bid`).
  - Clicking a company in the dropdown selects it, updates active status, and provides one-click access to open the `NodeDetailSheet`.
- **`frontend/src/components/ecosystem/EcosystemCanvas.tsx`** (Updated):
  - Supports both `stage` (Category Dropdown Hubs — default) and `mesh` (Full Topology Mesh) view modes.
  - View switcher control (`Stage View` vs `Mesh View`) in the canvas header.
  - Clean, deterministic layout for stage hubs in 5 columns with zero edge overlap.
- **`frontend/src/lib/ecosystem-layout.ts`** (Updated):
  - Exports `STAGE_LAYOUT` and `STAGE_EDGES` for deterministic stage hub positioning and packet routing.
- **`frontend/src/store/auctionStore.ts`** (Updated):
  - View mode state: `canvasViewMode: 'stage' | 'mesh'`.
  - Selected vendor per category: `activeVendorByCategory: Record<EntityCategory, string>`.
  - Actions: `setCanvasViewMode`, `setActiveVendorForCategory`.

---

## 4. Acceptance Criteria

- [ ] **AC-01: Category Stage Hubs**: When in Stage View (default), the canvas displays clean category stage cards: Publisher, CMP, DMP/Audience, Identity, SSP, DSP, Ad Server, Verification.
- [ ] **AC-02: Embedded Dropdown Buttons**: Each stage card contains an interactive dropdown button displaying the selected vendor name, domain, and chevron.
- [ ] **AC-03: Company List in Dropdown**: Opening the dropdown shows all companies in that category from `sellers.json` with domain and seller type.
- [ ] **AC-04: Auction Status Badges**: For demand partners (DSPs) and SSPs, the dropdown items surface live auction status badges (`Winner`, `Timed out`, `Below floor`, `No bid`).
- [ ] **AC-05: Selection & Detail Sheet Integration**: Selecting a company from the dropdown updates the stage card and allows opening the `NodeDetailSheet` for deep inspection.
- [ ] **AC-06: Clean Edge Routing**: Stage edges connect stages directly without crisscrossing or occluding other nodes.
- [ ] **AC-07: Packet Animation Compatibility**: In-flight bid packets animate seamlessly along stage edges during auction playback.
- [ ] **AC-08: View Mode Switcher**: Users can toggle between `Stage View` (dropdown hubs) and `Mesh View` (full 28-node graph).
- [ ] **AC-09: React Flow Drag Isolation**: Dropdown clicks and scrolls use `nodrag nopan` so canvas dragging does not trigger when interacting with the dropdown.
- [ ] **AC-10: Accessibility**: Dropdown controls are keyboard-navigable (`Tab`, `Space`, `Enter`, `Escape`, `Arrow` keys) and announce proper ARIA attributes.
- [ ] **AC-11: Test Suite**: All existing 170 Vitest tests pass with zero regressions, and new tests verify the category dropdown stage cards.

---

## 5. Out of Scope

- Dynamically parsing live external `sellers.json` URLs at runtime.
- Multi-publisher simultaneous bidding (simulation focuses on one active publisher slot).
