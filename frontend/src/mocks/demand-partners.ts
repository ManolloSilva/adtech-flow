/**
 * mocks/demand-partners.ts — the synthetic demand partners in the Alpha auction.
 *
 * Each partner is a deterministic mock DSP: given a request timestamp and the
 * seeded RNG it always produces the same CPM and latency, so the auction is
 * fully reproducible and testable. Nothing here talks to a real DSP.
 */

export interface DemandPartner {
  /** Node id in `ecosystem-nodes.json`. */
  readonly bidderId: string;
  /** Human-readable bidder name. */
  readonly name: string;
  /** SSP endpoint this bidder is wired through. */
  readonly sspId: string;
  /** Base CPM in USD before any floor/consent/latency effects. */
  readonly baseCpm: number;
  /** Simulated network round-trip latency in milliseconds. */
  readonly latencyMs: number;
  /** Deal ID this bidder is eligible for, when it only bids inside a PMP. */
  readonly dealId?: string;
  /** Creative sizes this bidder accepts. */
  readonly sizes: ReadonlyArray<[number, number]>;
  /** False when the bidder requires a specific consent purpose. */
  readonly requiresConsent: boolean;
}

/**
 * The Alpha slice ships with three mock demand partners (BACKLOG A-01):
 * The Trade Desk, Google DV360, and Amazon DSP — all routed through Magnite,
 * PubMatic, and OpenX respectively.
 */
export const DEMAND_PARTNERS: ReadonlyArray<DemandPartner> = [
  {
    bidderId: 'node-dsp-ttd',
    name: 'The Trade Desk',
    sspId: 'node-ssp-magnite',
    baseCpm: 2.6,
    latencyMs: 140,
    sizes: [
      [300, 250],
      [728, 90],
    ],
    requiresConsent: true,
  },
  {
    bidderId: 'node-dsp-dv360',
    name: 'Google DV360',
    sspId: 'node-ssp-pubmatic',
    baseCpm: 2.1,
    latencyMs: 195,
    sizes: [
      [300, 250],
      [300, 600],
    ],
    requiresConsent: true,
  },
  {
    bidderId: 'node-dsp-amazon',
    name: 'Amazon DSP',
    sspId: 'node-ssp-openx',
    baseCpm: 1.25,
    latencyMs: 220,
    sizes: [[300, 250]],
    requiresConsent: false,
  },
];

export function findPartnerById(bidderId: string): DemandPartner | undefined {
  return DEMAND_PARTNERS.find((p) => p.bidderId === bidderId);
}