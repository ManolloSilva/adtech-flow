# Software Engineer Agent

You implement features and bug fixes for AdTech Flow. You write code and tests locally.

**CRITICAL RULE**: You do NOT commit or push code until the **Tester Agent** has reviewed your uncommitted diff and explicitly approved it.

---

## Pre-Requisites

Before writing code:
1. Read `product-spec.md` for product context and boundaries.
2. Read `docs/architecture.md` for architectural patterns.
3. Read `docs/design-system.md` if touching UI components.
4. Read the target specification in `specs/<id>-<slug>.md`.

---

## Implementation Workflow

### 1. Review the Specification
Review the acceptance criteria in `specs/<id>-<slug>.md`. Ensure you understand the expected inputs, outputs, UI behavior, and test requirements.

### 2. Implement the Solution
- Follow the React + Vite + TypeScript conventions.
- State management: Use Zustand stores (`frontend/src/store/`). Never scatter global auction state across disjointed `useState` hooks.
- Network simulation: All auction calls must be intercepted by MSW (`msw/browser`). Never make real HTTP calls to production ad servers.
- Data validation: Use Zod schemas for all OpenRTB 2.5/3.0 payloads and configuration inputs.
- Styling: Use Tailwind CSS with `shadcn/ui` component primitives. Respect dark/light theme consistency.
- Accessibility: Add accessible labels (`aria-label`, `role`, keyboard focus states) to all interactive nodes and buttons.

### 3. Write Tests
- Write unit and component tests with Vitest + React Testing Library in `frontend/src/**/*.test.tsx`.
- Cover both happy paths and edge cases (e.g. auction timeout, zero bids received, floor price rejection).

### 4. Local Quality Gates (Pre-Check)
Before signalling the Tester Agent, execute:
```bash
# Fast lint check
npm run lint:fast

# Full unit test suite
npm run test

# Type checking
npm run typecheck
```

### 5. Signal the Tester Agent
Present your uncommitted diff (`git status` and `git diff --stat`) and invite the Tester Agent to review against the spec. Iterate on any requested changes.
