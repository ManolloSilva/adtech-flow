/** Shared domain types for the Alpha slice. */

/** The eight semantic roles from docs/design-system.md §1. */
export type EntityCategory =
  | 'publisher'
  | 'cmp'
  | 'audience'
  | 'identity'
  | 'ssp'
  | 'dsp'
  | 'adserver'
  | 'verification';

export type SellerType = 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';

export interface EcosystemNodeData {
  id: string;
  name: string;
  category: EntityCategory;
  domain: string;
  sellerType: SellerType;
  description: string;
  isOptional?: boolean;
  sourceSsp?: string;
}

/**
 * Auction lifecycle phases, in canonical order.
 * Conditional phases (audience / identity / verification) are skipped at runtime
 * when the corresponding optional vendor is disabled.
 */
export type AuctionPhase =
  | 'IDLE'
  | 'CONSENT_RESOLVED'
  | 'AUDIENCE_ENRICHED'
  | 'ID_MODULES_LOADED'
  | 'BID_REQUESTS_FIRED'
  | 'BIDS_COLLECTED'
  | 'TIMEOUT_APPLIED'
  | 'GAM_ARBITRATION'
  | 'AD_RENDERED'
  | 'VERIFICATION_MEASURED';

export type BidStatus =
  | 'submitted'
  | 'won'
  | 'lost'
  | 'timed_out'
  | 'below_floor'
  | 'no_bid';

export interface BidderResult {
  bidderId: string;
  bidderName: string;
  sspId: string;
  cpm: number;
  currency: string;
  latencyMs: number;
  status: BidStatus;
  dealId?: string;
  /** Human-readable explanation of the current status (shown in the waterfall). */
  reason?: string;
}

export type PacketKind =
  | 'consent'
  | 'data'
  | 'bid-request'
  | 'bid-response'
  | 'timeout'
  | 'render'
  | 'measurement';

/** One animated data packet travelling along a canvas edge. */
export interface Packet {
  id: string;
  source: string;
  target: string;
  kind: PacketKind;
  label: string;
}

export interface VerificationReport {
  vendor: string;
  viewabilityScore: number;
  viewable: boolean;
  measurementStandard: string;
  ivtRate: number;
  ivtClassification: 'CLEAN' | 'SUSPICIOUS';
  brandSafetyStatus: 'SAFE' | 'FLAGGED';
}

export interface AuctionConfig {
  /** Publisher floor in USD CPM. */
  floorPrice: number;
  /** Auction timeout (`tmax`) in milliseconds. */
  timeoutMs: number;
  /** TCF v2.2 consent granted. */
  gdprConsent: boolean;
  /** Demand partner node ids taking part in the auction. */
  activeBidders: string[];
  /** Permutive — first-party cohorts & Seller-Defined Audiences. */
  includeAudience: boolean;
  /** LiveRamp / Prebid SharedID — pseudonymous envelope IDs. */
  includeIdentity: boolean;
  /** Integral Ad Science — post-bid measurement & verification. */
  includeVerification: boolean;
  /** When set, restricts the auction to a PMP deal. */
  dealId?: string;
  /** Deterministic nonce so each auction run gets a fresh request id. */
  requestNonce: number;
}

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed';

export type CanvasViewMode = 'stage' | 'mesh';