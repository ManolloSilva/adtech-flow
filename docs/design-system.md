# Design System Documentation

AdTech Flow uses a modern, clean, dark/light theme based on Tailwind CSS and `shadcn/ui` primitives.

---

## 1. Color Tokens & Entity Role Palette

Every participant in the programmatic ad ecosystem has a designated semantic color badge and node accent:

| Entity Type | Semantic Color | Tailwind Token | Description |
| :--- | :--- | :--- | :--- |
| **Publisher** | Emerald | `bg-emerald-500/10 text-emerald-500 border-emerald-500/20` | Content site where ads are rendered |
| **CMP (Consent)** | Purple | `bg-purple-500/10 text-purple-500 border-purple-500/20` | Consent Management Platform (TCF v2.2) |
| **Audience (SDA)** | Teal | `bg-teal-500/10 text-teal-400 border-teal-500/20` | First-party cohorts & Seller-Defined Audiences (Permutive) |
| **Identity** | Cyan | `bg-cyan-500/10 text-cyan-500 border-cyan-500/20` | Universal IDs (SharedID, LiveRamp) |
| **SSP** | Blue | `bg-blue-500/10 text-blue-500 border-blue-500/20` | Supply-Side Platform (Magnite, PubMatic, OpenX) |
| **DSP** | Amber | `bg-amber-500/10 text-amber-500 border-amber-500/20` | Demand-Side Platform (The Trade Desk, DV360) |
| **Ad Server** | Indigo | `bg-indigo-500/10 text-indigo-500 border-indigo-500/20` | Google Ad Manager / Mock Ad Server |
| **Verification** | Rose | `bg-rose-500/10 text-rose-400 border-rose-500/20` | Digital ad measurement & verification (IAS) |

---

## 2. Typography & Badges

- **Headings & Canvas Labels**: `Inter`, `sans-serif`
- **Code & OpenRTB JSON**: `JetBrains Mono` or `Fira Code`, `monospace`
- **Company Branding**: Always rendered as standard typography badges (e.g. `<Badge variant="outline">The Trade Desk</Badge>`). No proprietary graphic logos to adhere to Nominative Fair Use guidelines.

---

## 3. Interactive States

- **Default Node**: Subtle border, neutral background.
- **Hover**: Slight border brightness, elevation shadow.
- **Selected**: 2px primary focus ring with matching entity accent color.
- **Transiting Packet**: Animated glowing edge pulse from source to target node using Framer Motion.
- **Timeout / Dropped**: Reduced opacity (50%), red outline with badge "Timed out (>250ms)".
- **Floor Rejected**: Amber outline with badge "Below floor (<$1.50)".

---

## 4. Accessibility (WCAG 2.1 AA)

- All interactive nodes support keyboard navigation (Tab to focus, Enter/Space to select).
- Focus rings are mandatory (`focus-visible:ring-2 focus-visible:ring-offset-2`).
- A dedicated **Waterfall List / Table View** is available for assistive technologies and mobile displays. *(Beta — `ACC-01`.)*

### Implementation notes

The role palette is defined **once**, in `frontend/src/lib/roleStyles.ts` (`ROLE_STYLES`),
and consumed by the node card, detail sheet, filter bar, legend, and packet animations.
Adding a role in one place therefore updates it everywhere — the Alpha milestone
previously duplicated these colours as an inline map in `App.tsx`, which drifted.

Two accessibility traps worth recording:

1. **Radix `Slider` is not accessible on its own.** It puts `aria-label` and
   `aria-valuetext` on a `<span>` root with no slider role, so screen readers announce
   nothing and the value is not reachable by keyboard. Use the `AccessibleRange`
   wrapper in `src/components/ui/slider.tsx`, which renders a real
   `<input type="range">`.
2. **React Flow node wrappers are not keyboard-focusable.** We set
   `nodesFocusable={false}` and render a real `<button>` inside the custom node, so the
   inner element owns focus and carries the accessible name, role, and `aria-pressed`.

### Status badge tokens

Applied to node cards when a bid is rejected, per §3:

| State | Badge classes |
| :--- | :--- |
| Winner | `bg-emerald-500/20 text-emerald-300 border-emerald-500/40` |
| Timed out | `bg-red-500/20 text-red-300 border-red-500/40` |
| Below floor | `bg-amber-500/20 text-amber-300 border-amber-500/40` |
| Did not bid | `bg-slate-700/50 text-slate-400 border-slate-700` |
