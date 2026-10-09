# Spec: S-02 Configure Tailwind CSS + shadcn/ui

**Issue ID**: `S-02`
**Status**: `🔨 in-progress` (previously mis-marked ✅ — no Tailwind was ever installed)
**Assigned Roles**: Product Manager (Spec), Software Engineer (Implementation), Tester (Verification)

---

## 1. User Story & Intent

As a developer building AdTech Flow, I need a **working** styling solution and component primitives,
so that every subsequent UI issue (node cards, inspector panels, timeline slider) can be built on a real
CSS foundation instead of unstyled utility classes.

> **Context:** The previous agent marked this `✅` but never installed `tailwindcss`. `vite build`
> emitted a **0.24 kB** CSS bundle, so `@tailwind` directives were dropped and `App.tsx` rendered
> completely unstyled. Acceptance criteria below are written to be *verifiable by the tester*.

---

## 2. Acceptance Criteria

- [ ] `tailwindcss` and `@tailwindcss/vite` are in `package.json` (`devDependencies`) and resolvable in `node_modules`.
- [ ] `vite.config.ts` registers the `@tailwindcss/vite` plugin **before** the react plugin's output stage.
- [ ] `src/index.css` uses the **Tailwind v4** entry directive (`@import "tailwindcss";`) — the legacy
      `@tailwind base/components/utilities` triple is removed.
- [ ] `components.json` exists at `frontend/` root with valid `shadcn/ui` v4 schema (`$schema`, `style: "new-york"`,
      `rsc: false`, `tsx: true`, `aliases` pointing at `@/components` and `@/lib/utils`).
- [ ] `src/lib/utils.ts` exports `cn(...inputs: ClassValue[])` using `clsx` + `tailwind-merge`.
- [ ] Path alias `@/*` is configured in **all three** tsconfig files (`tsconfig.app.json`, `tsconfig.node.json`)
      and mirrored in `vite.config.ts` via `resolve.alias` (required for Vitest + ESLint to agree).
- [ ] `src/components/ui/` contains **shadcn/ui** primitives (`button`, `card`, `badge`, `sheet`, `slider`,
      `switch`, `tabs`, `separator`, `scroll-area`, `collapsible`, `tooltip`, `skeleton`).
- [ ] `npm run build` emits a CSS bundle **> 8 kB** (proves Tailwind is actually generating utilities).
- [ ] `npm run typecheck` passes with zero errors.
- [ ] Theme tokens from `docs/design-system.md` are exposed as CSS custom properties in `:root`/`.dark`
      via `@theme` (emerald/purple/teal/cyan/blue/amber/indigo/rose role palette).

---

## 3. Component Scope and Data Model

- `src/lib/utils.ts` — `cn()` helper. No product data model changes.
- `src/index.css` — Tailwind v4 `@theme` block mapping the 8 role colours to Tailwind tokens so
  `bg-emerald-500/10` etc. stay valid and are centrally documented.
- `src/components/ui/*` — vendored shadcn/ui source (Radix + CVA). **Not** product components.

---

## 4. Edge Cases & Out-of-Scope Items

- Tailwind v4 does **not** use `tailwind.config.js` by default; content detection is automatic.
  A legacy config file must **not** be introduced.
- `postcss.config.js` is **not** required when using `@tailwindcss/vite`. Must not be added.
- Out of scope: product UI (ecosystem map, auction controls) — those are `M-*` and `A-*`.
- Out of scope: dark/light toggle — the app is dark-only for Alpha.

---

## 5. Tester Verification Commands

```bash
cd frontend
npm ls tailwindcss @tailwindcss/vite            # must resolve
npm run typecheck                               # 0 errors
npm run build 2>&1 | grep '\.css'              # CSS asset > 8 kB
```