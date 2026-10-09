/**
 * auction-engine.ts — the deterministic Alpha auction engine.
 *
 * This module is the single source of truth for the auction state machine and
 * is executed inside a Web Worker (see `auction.worker.ts`) in the browser.
 *
 * Determinism contract: given the same `AuctionConfig` and the same demand
 * partner table, the engine always produces the same bids, same ordering, and
 * the same winner. Nothing depends on `Math.random()` or wall-clock time.
 */

import {
  BidRequestSchema,
  type BidRequest,
  buildBidRequest,
  buildBidResponse,
} from '@/lib/openrtb';
import { DEMAND_PARTNERS, type DemandPartner } from '@/mocks/demand-partners';
import type {
  AuctionConfig,
  AuctionPhase,
  BidderResult,
  Packet,
  VerificationReport,
} from '@/types';

export interface AuctionEngineState {
  phase: AuctionPhase;
  /** Monotonic elapsed auction time in milliseconds (the timeline axis). */
  elapsedMs: number;
  packets: Packet[];
  bids: BidderResult[];
  winningBid: BidderResult | null;
  verificationReport: VerificationReport | null;
  lastRequest: BidRequest | null;
  lastResponse: unknown | null;
}

/** Total wall-clock span the timeline slider maps to (0 → 300ms). */
export const AUCTION_DURATION_MS = 300;

/**
 * Phase schedule. Each entry is the timestamp at which that phase *begins*.
 * The Alpha slice is a hardcoded demo auction, so the schedule is static and
 * every transition is therefore reproducible.
 */
export const PHASE_SCHEDULE: ReadonlyArray<{ phase: AuctionPhase; atMs: number }> = [
  { phase: 'IDLE', atMs: 0 },
  { phase: 'CONSENT_RESOLVED', atMs: 40 },
  { phase: 'AUDIENCE_ENRICHED', atMs: 70 },
  { phase: 'ID_MODULES_LOADED', atMs: 95 },
  { phase: 'BID_REQUESTS_FIRED', atMs: 120 },
  { phase: 'BIDS_COLLECTED', atMs: 200 },
  { phase: 'TIMEOUT_APPLIED', atMs: 240 },
  { phase: 'GAM_ARBITRATION', atMs: 270 },
  { phase: 'AD_RENDERED', atMs: 295 },
  { phase: 'VERIFICATION_MEASURED', atMs: 300 },
];

/** Phases that are skipped depending on the optional-vendor configuration. */
const CONDITIONAL_PHASES: Partial<Record<AuctionPhase, keyof AuctionConfig>> = {
  AUDIENCE_ENRICHED: 'includeAudience',
  ID_MODULES_LOADED: 'includeIdentity',
  VERIFICATION_MEASURED: 'includeVerification',
};

/**
 * Phases that only occur when an ad actually won the auction.
 *
 * Without this, a run where every bid was rejected would still advance to
 * `AD_RENDERED` and `VERIFICATION_MEASURED` — claiming a creative rendered and
 * was measured when no impression was ever served. That is both wrong and, in
 * an educational tool, actively misleading.
 */
const REQUIRES_WINNING_BID: ReadonlySet<AuctionPhase> = new Set([
  'AD_RENDERED',
  'VERIFICATION_MEASURED',
]);

/** Returns the ordered phase list for a given configuration. */
export function activePhasesFor(config: AuctionConfig): AuctionPhase[] {
  const hasWinner = DEMAND_PARTNERS.some(
    (partner) => evaluateBid(partner, config).status === 'submitted',
  );

  return PHASE_SCHEDULE.filter(({ phase }) => {
    const flag = CONDITIONAL_PHASES[phase];
    if (flag && !config[flag]) return false;
    if (REQUIRES_WINNING_BID.has(phase) && !hasWinner) return false;
    return true;
  }).map(({ phase }) => phase);
}

/** Maps a timeline position (ms) to the phase that is current at that instant. */
export function phaseAtElapsed(config: AuctionConfig, elapsedMs: number): AuctionPhase {
  // Derive the schedule from `activePhasesFor` so time and phase can never
  // disagree about which phases exist.
  const active = new Set(activePhasesFor(config));

  let current: AuctionPhase = 'IDLE';
  for (const { phase, atMs } of PHASE_SCHEDULE) {
    if (active.has(phase) && elapsedMs >= atMs) {
      current = phase;
    }
  }
  return current;
}

/* -------------------------------------------------------------------------- */
/* Request construction                                                        */
/* -------------------------------------------------------------------------- */

export function buildAuctionRequest(config: AuctionConfig): BidRequest {
  const bidderCodes = DEMAND_PARTNERS.filter(
    (p) => config.activeBidders.includes(p.bidderId),
  ).map((p) => p.bidderId.replace('node-dsp-', ''));

  return buildBidRequest({
    requestId: `req-${config.requestNonce}`,
    impressionId: 'imp-1',
    bidderCodes,
    floorPrice: config.floorPrice,
    timeoutMs: config.timeoutMs,
    consentGranted: config.gdprConsent,
    includeAudience: config.includeAudience,
    includeIdentity: config.includeIdentity,
    ...(config.dealId ? { dealId: config.dealId } : {}),
    seatIds: [
      '88.0',
      ...DEMAND_PARTNERS.filter((p) => config.activeBidders.includes(p.bidderId)).map(
        (p) => p.sspId.replace('node-ssp-', ''),
      ),
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Packet generation                                                           */
/* -------------------------------------------------------------------------- */

const SSP_ID_BY_BIDDER: Record<string, string> = Object.fromEntries(
  DEMAND_PARTNERS.map((p) => [p.bidderId, p.sspId]),
);

/**
 * Produces the animation packets for the current phase. Packets are data, not
 * side effects — the renderer turns them into Framer Motion edge pulses, which
 * keeps the engine testable and the animation purely presentational.
 */
export function packetsForPhase(
  phase: AuctionPhase,
  config: AuctionConfig,
): Packet[] {
  const active = DEMAND_PARTNERS.filter((p) => config.activeBidders.includes(p.bidderId));

  switch (phase) {
    case 'CONSENT_RESOLVED':
      return [{ id: 'pkt-consent', source: 'node-pub-nytimes', target: 'node-cmp-onetrust', kind: 'consent', label: 'TCF 2.2' }];

    case 'AUDIENCE_ENRICHED':
      return config.includeAudience
        ? [{ id: 'pkt-audience', source: 'node-audience-permutive', target: 'node-pub-nytimes', kind: 'data', label: 'SDA' }]
        : [];

    case 'ID_MODULES_LOADED':
      return config.includeIdentity
        ? [
            { id: 'pkt-id-1', source: 'node-id-liveramp', target: 'node-pub-nytimes', kind: 'data', label: 'RampID' },
            { id: 'pkt-id-2', source: 'node-id-sharedid', target: 'node-pub-nytimes', kind: 'data', label: 'SharedID' },
          ]
        : [];

    case 'BID_REQUESTS_FIRED':
      // Publisher → SSP (prebid wrapper), then SSP → DSP (the actual RTB call).
      return [
        ...active.map((p) => ({
          id: `pkt-req-${p.bidderId}-wrapper`,
          source: 'node-pub-nytimes',
          target: SSP_ID_BY_BIDDER[p.bidderId],
          kind: 'bid-request' as const,
          label: 'OpenRTB 2.5',
        })),
        ...active.map((p) => ({
          id: `pkt-req-${p.bidderId}`,
          source: SSP_ID_BY_BIDDER[p.bidderId],
          target: p.bidderId,
          kind: 'bid-request' as const,
          label: 'Bid Request',
        })),
      ];

    case 'BIDS_COLLECTED':
      // Responses travel back DSP → SSP → publisher.
      return [
        ...active.map((p) => ({
          id: `pkt-resp-${p.bidderId}`,
          source: p.bidderId,
          target: SSP_ID_BY_BIDDER[p.bidderId],
          kind: 'bid-response' as const,
          label: `$${p.baseCpm.toFixed(2)}`,
        })),
        ...active.map((p) => ({
          id: `pkt-resp-${p.bidderId}-upstream`,
          source: SSP_ID_BY_BIDDER[p.bidderId],
          target: 'node-pub-nytimes',
          kind: 'bid-response' as const,
          label: 'hb_pb',
        })),
      ];

    case 'TIMEOUT_APPLIED':
      return [{ id: 'pkt-timeout', source: 'node-pub-nytimes', target: 'node-adserver-gam', kind: 'timeout', label: 'tmax' }];

    case 'GAM_ARBITRATION':
      return [{ id: 'pkt-gam', source: 'node-pub-nytimes', target: 'node-adserver-gam', kind: 'bid-request', label: 'hb_pb / key-value' }];

    case 'AD_RENDERED':
      return [{ id: 'pkt-render', source: 'node-adserver-gam', target: 'node-pub-nytimes', kind: 'render', label: 'Impression' }];

    case 'VERIFICATION_MEASURED':
      return config.includeVerification
        ? [{ id: 'pkt-ias', source: 'node-verification-ias', target: 'node-pub-nytimes', kind: 'measurement', label: 'IAS' }]
        : [];

    default:
      return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Bid evaluation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Applies the four rejection rules in the order a real seller would:
 *   1. inactive / no consent   → no_bid
 *   2. network timeout         → timed_out
 *   3. PMP deal restriction    → no_bid
 *   4. floor enforcement       → below_floor
 *
 * Pure function — unit-tested directly without touching the network.
 */
export function evaluateBid(
  partner: DemandPartner,
  config: AuctionConfig,
): BidderResult {
  const base: BidderResult = {
    bidderId: partner.bidderId,
    bidderName: partner.name,
    sspId: partner.sspId,
    cpm: partner.baseCpm,
    currency: 'USD',
    latencyMs: partner.latencyMs,
    status: 'submitted',
    ...(partner.dealId ? { dealId: partner.dealId } : {}),
  };

  if (!config.activeBidders.includes(partner.bidderId)) {
    return { ...base, status: 'no_bid', reason: 'Bidder deactivated' };
  }

  if (partner.requiresConsent && !config.gdprConsent) {
    return { ...base, status: 'no_bid', reason: 'Consent withdrawn (TCF purpose 1)' };
  }

  if (config.dealId && partner.dealId !== config.dealId) {
    return { ...base, status: 'no_bid', reason: `Not a deal holder for ${config.dealId}` };
  }

  if (partner.latencyMs > config.timeoutMs) {
    return { ...base, status: 'timed_out', reason: `Latency ${partner.latencyMs}ms > tmax ${config.timeoutMs}ms` };
  }

  if (partner.baseCpm < config.floorPrice) {
    return {
      ...base,
      status: 'below_floor',
      reason: `$${partner.baseCpm.toFixed(2)} < floor $${config.floorPrice.toFixed(2)}`,
    };
  }

  return base;
}

/** Highest CPM among eligible bids wins. Ties break on lower latency, then id. */
export function selectWinner(bids: BidderResult[]): BidderResult | null {
  const eligible = bids.filter((b) => b.status === 'submitted');
  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort(
    (a, b) => b.cpm - a.cpm || a.latencyMs - b.latencyMs || a.bidderId.localeCompare(b.bidderId),
  );
  return sorted[0];
}

/** Applies winner/loser status once arbitration happens. */
export function applyArbitration(bids: BidderResult[]): {
  bids: BidderResult[];
  winningBid: BidderResult | null;
} {
  const winner = selectWinner(bids);
  return {
    bids: bids.map((b) =>
      b.status === 'submitted' ? { ...b, status: b.bidderId === winner?.bidderId ? 'won' : 'lost' } : b,
    ),
    winningBid: winner ? { ...winner, status: 'won' } : null,
  };
}

/**
 * Runs the whole auction synchronously. Used by tests and by `Step Back`
 * recalculation; the animated UI advances phase-by-phase instead.
 */
export function runAuction(config: AuctionConfig): AuctionEngineState {
  const request = buildAuctionRequest(config);
  const parsed = BidRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error(
      `Generated BidRequest failed OpenRTB validation: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  const evaluated = DEMAND_PARTNERS.map((partner) => evaluateBid(partner, config));
  const { bids, winningBid } = applyArbitration(evaluated);
  const winnerBid = winningBid;
  const winnerPartner = winnerBid
    ? DEMAND_PARTNERS.find((p) => p.bidderId === winnerBid.bidderId)
    : undefined;

  return {
    phase: 'AD_RENDERED',
    elapsedMs: AUCTION_DURATION_MS,
    packets: [],
    bids,
    winningBid,
    verificationReport: winnerBid ? deriveVerificationReport(winnerBid.cpm, config) : null,
    lastRequest: request,
    lastResponse: winnerPartner
      ? buildBidResponse({
          bidId: `${winnerPartner.bidderId}-bid`,
          impressionId: 'imp-1',
          bidderCode: winnerPartner.bidderId.replace('node-dsp-', ''),
          bidderName: winnerPartner.name,
          cpm: winnerBid!.cpm,
          latencyMs: winnerBid!.latencyMs,
          winning: true,
        })
      : null,
  };
}

/**
 * Derives the IAS report from the winning CPM rather than hardcoding it, so the
 * numbers actually respond to auction configuration (BACKLOG A-07).
 */
export function deriveVerificationReport(
  cpm: number,
  config: AuctionConfig,
): VerificationReport | null {
  if (!config.includeVerification) return null;
  return {
    viewabilityScore: Math.min(96, Math.round(62 + cpm * 11)),
    viewable: Math.min(96, Math.round(62 + cpm * 11)) >= 70,
    measurementStandard: 'MRC / OMID',
    ivtRate: cpm < 1 ? 4.2 : 1.1,
    ivtClassification: cpm < 1 ? 'SUSPICIOUS' : 'CLEAN',
    brandSafetyStatus: cpm >= 2 ? 'SAFE' : 'FLAGGED',
    vendor: 'Integral Ad Science',
  };
}

/** Full ordered pipeline of packets, useful for tests and the waterfall view. */
export function allPackets(config: AuctionConfig): Packet[] {
  return activePhasesFor(config).flatMap((phase) => packetsForPhase(phase, config));
}