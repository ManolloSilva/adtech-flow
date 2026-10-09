/**
 * roleStyles.ts — the single source of truth mapping entity category → visual tokens.
 *
 * Values mirror docs/design-system.md §1 exactly. Centralising them here means the
 * node card, the detail panel, the filter bar, and the legend can never drift.
 */

import type { EntityCategory } from '@/types';

export interface RoleStyle {
  /** Border/bg/text Tailwind class triple for badges. */
  readonly badge: string;
  /** Node card accent (border + ring). */
  readonly node: string;
  /** Framer Motion / CSS hex used for packet colours. */
  readonly hex: string;
  readonly label: string;
}

export const ROLE_STYLES: Record<EntityCategory, RoleStyle> = {
  publisher: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    node: 'border-emerald-500/40 hover:border-emerald-500/70',
    hex: '#34d399',
    label: 'Publisher',
  },
  cmp: {
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    node: 'border-purple-500/40 hover:border-purple-500/70',
    hex: '#c084fc',
    label: 'CMP',
  },
  audience: {
    badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    node: 'border-teal-500/40 hover:border-teal-500/70',
    hex: '#2dd4bf',
    label: 'Audience',
  },
  identity: {
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    node: 'border-cyan-500/40 hover:border-cyan-500/70',
    hex: '#22d3ee',
    label: 'Identity',
  },
  ssp: {
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    node: 'border-blue-500/40 hover:border-blue-500/70',
    hex: '#60a5fa',
    label: 'SSP',
  },
  dsp: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    node: 'border-amber-500/40 hover:border-amber-500/70',
    hex: '#fbbf24',
    label: 'DSP',
  },
  adserver: {
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    node: 'border-indigo-500/40 hover:border-indigo-500/70',
    hex: '#818cf8',
    label: 'Ad Server',
  },
  verification: {
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    node: 'border-rose-500/40 hover:border-rose-500/70',
    hex: '#fb7185',
    label: 'Verification',
  },
};

/** Ordered list used by the category filter bar (BACKLOG M-05). */
export const CATEGORY_ORDER: ReadonlyArray<EntityCategory> = [
  'publisher',
  'cmp',
  'adserver',
  'ssp',
  'dsp',
  'identity',
  'audience',
  'verification',
];

export const CATEGORY_DESCRIPTIONS: Record<EntityCategory, string> = {
  publisher: 'Content site that owns the page, the consent flow, and the ad slot.',
  cmp: 'Consent Management Platform resolving IAB TCF v2.2 before any bid is built.',
  adserver: 'Ad server arbitrating direct line items against the winning programmatic bid.',
  ssp: 'Supply-Side Platform running the auction, floors, and deal precedence.',
  dsp: 'Demand-Side Platform bidding on the impression.',
  identity: 'Pseudonymous envelope IDs for frequency capping and audience matching.',
  audience: 'First-party cohorts and Seller-Defined Audience segments.',
  verification: 'Post-bid measurement: viewability, brand safety, and IVT.',
};

export function roleStyle(category: string): RoleStyle {
  return ROLE_STYLES[category as EntityCategory] ?? ROLE_STYLES.publisher;
}

/** Human-readable label for a phase key, e.g. `BID_REQUESTS_FIRED` → `Bid Requests Fired`. */
export function humanizePhase(phase: string): string {
  return phase
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}