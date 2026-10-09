/**
 * auctionStore.ts — global Zustand store driving the Alpha auction UI.
 *
 * Responsibilities:
 *  - Own the simulation configuration and derive everything from it (steps, packets, bids).
 *  - Drive the deterministic playback timeline (0 → 300ms) shared by the slider,
 *    the canvas animation, and the waterfall list.
 *  - Expose pure actions (play / pause / stepNext / stepBack / reset / updateConfig)
 *    so components never compute auction logic themselves.
 *
 * Determinism: the store never calls `Math.random()` and never derives state from
 * wall-clock time. Elapsed time is driven by a single rAF loop, and all results
 * come from `runAuction()` in `auction/auction-engine.ts`.
 */

import { create } from 'zustand';

import {
  AUCTION_DURATION_MS,
  activePhasesFor,
  packetsForPhase,
  phaseAtElapsed,
  runAuction,
} from '@/auction/auction-engine';
import { DEMAND_PARTNERS } from '@/mocks/demand-partners';
import type {
  AuctionConfig,
  AuctionPhase,
  BidderResult,
  Packet,
  PlaybackStatus,
  VerificationReport,
} from '@/types';

const ALL_BIDDER_IDS = DEMAND_PARTNERS.map((p) => p.bidderId);

/**
 * Every ecosystem category starts visible. Declared separately so `reset()` can
 * restore it — category visibility is view state, not user configuration, and
 * must not survive a simulation reset.
 */
const DEFAULT_CATEGORY_VISIBILITY: Record<string, boolean> = {
  publisher: true,
  cmp: true,
  adserver: true,
  ssp: true,
  dsp: true,
  identity: true,
  audience: true,
  verification: true,
};

const DEFAULT_CONFIG: AuctionConfig = {
  floorPrice: 1.5,
  timeoutMs: 250,
  gdprConsent: true,
  activeBidders: [...ALL_BIDDER_IDS],
  includeAudience: true,
  includeIdentity: true,
  includeVerification: true,
  requestNonce: 1,
};

/** Wall-clock duration of one real-time second in simulation milliseconds. */
const SIMULATION_SPEED = 1;

export interface AuctionState {
  /* ----------------------------- Simulation ----------------------------- */
  elapsedMs: number;
  phase: AuctionPhase;
  phases: AuctionPhase[];
  playback: PlaybackStatus;

  /* ------------------------------- Results ------------------------------ */
  config: AuctionConfig;
  bids: BidderResult[];
  winningBid: BidderResult | null;
  verificationReport: VerificationReport | null;
  packets: Packet[];

  /* ------------------------------ UI state ------------------------------ */
  selectedNodeId: string | null;
  visibleCategories: Record<string, boolean>;
  isInspectorOpen: boolean;

  /* ------------------------------- Actions ------------------------------ */
  play: () => void;
  pause: () => void;
  stepTo: (elapsedMs: number) => void;
  stepNext: () => void;
  stepBack: () => void;
  reset: () => void;
  updateConfig: (patch: Partial<AuctionConfig>) => void;
  toggleBidder: (bidderId: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setInspectorOpen: (open: boolean) => void;
  toggleCategory: (category: string) => void;
}

/** Recomputes everything that depends on `config`, at a given elapsed time. */
function deriveState(config: AuctionConfig, elapsedMs: number) {
  const phases = activePhasesFor(config);
  const phase = phaseAtElapsed(config, elapsedMs);
  const result = runAuction(config);
  const packets = packetsForPhase(phase, config);

  // Bids only become visible once the bid phase has started, mirroring the
  // waterfall: you cannot see a bid that has not been sent yet.
  const phaseIndex = phases.indexOf(phase);
  const revealed =
    phaseIndex >= phases.indexOf('BID_REQUESTS_FIRED');

  return {
    phases,
    phase,
    packets,
    bids: revealed ? result.bids : ALL_BIDDER_IDS.map((id) => ({
      bidderId: id,
      bidderName: DEMAND_PARTNERS.find((p) => p.bidderId === id)?.name ?? id,
      sspId: DEMAND_PARTNERS.find((p) => p.bidderId === id)?.sspId ?? '',
      cpm: DEMAND_PARTNERS.find((p) => p.bidderId === id)?.baseCpm ?? 0,
      currency: 'USD',
      latencyMs: DEMAND_PARTNERS.find((p) => p.bidderId === id)?.latencyMs ?? 0,
      status: 'submitted' as const,
    })),
    winningBid: phaseIndex >= phases.indexOf('GAM_ARBITRATION') ? result.winningBid : null,
    verificationReport:
      phaseIndex >= phases.indexOf('VERIFICATION_MEASURED') ? result.verificationReport : null,
  };
}

/** Elapsed time of the first occurrence of `phase` in the active schedule. */
function elapsedForPhase(phases: AuctionPhase[], target: AuctionPhase): number {
  const schedule: Record<AuctionPhase, number> = {
    IDLE: 0,
    CONSENT_RESOLVED: 40,
    AUDIENCE_ENRICHED: 70,
    ID_MODULES_LOADED: 95,
    BID_REQUESTS_FIRED: 120,
    BIDS_COLLECTED: 200,
    TIMEOUT_APPLIED: 240,
    GAM_ARBITRATION: 270,
    AD_RENDERED: 295,
    VERIFICATION_MEASURED: 300,
  };
  const index = phases.indexOf(target);
  if (index <= 0) return 0;
  return schedule[phases[index]];
}

let rafId: number | null = null;
let lastFrameAt = 0;

function stopLoop() {
  if (rafId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(rafId);
  }
  rafId = null;
}

export const useAuctionStore = create<AuctionState>((set, get) => {
  const initial = deriveState(DEFAULT_CONFIG, 0);

  /** Single requestAnimationFrame loop advancing the deterministic timeline. */
  const tick = (now: number) => {
    const state = get();
    if (state.playback !== 'playing') {
      rafId = null;
      return;
    }

    if (lastFrameAt === 0) lastFrameAt = now;
    const deltaReal = now - lastFrameAt;
    lastFrameAt = now;

    // A 1:1 real-time mapping would be imperceptible (300ms), so we scale up:
    // 250ms of wall clock advances the full 300ms simulation (8× slow motion),
    // matching the "slow motion" requirement in product-spec.md F-02.
    const deltaSim = deltaReal * (AUCTION_DURATION_MS / 250) * SIMULATION_SPEED;
    const nextElapsed = Math.min(AUCTION_DURATION_MS, state.elapsedMs + deltaSim);

    if (nextElapsed >= AUCTION_DURATION_MS) {
      set({ elapsedMs: nextElapsed, playback: 'completed', ...deriveState(state.config, nextElapsed) });
      stopLoop();
      return;
    }

    set({ elapsedMs: nextElapsed, ...deriveState(state.config, nextElapsed) });
    rafId = requestAnimationFrame(tick);
  };

  return {
    elapsedMs: 0,
    phase: 'IDLE',
    phases: initial.phases,
    playback: 'idle',

    config: DEFAULT_CONFIG,
    bids: initial.bids,
    winningBid: null,
    verificationReport: null,
    packets: [],

    selectedNodeId: null,
    visibleCategories: { ...DEFAULT_CATEGORY_VISIBILITY },
    isInspectorOpen: false,

    play: () => {
      const { elapsedMs, config, playback } = get();
      // Replay from the start when the simulation already finished.
      const from = playback === 'completed' ? 0 : elapsedMs;
      lastFrameAt = 0;
      stopLoop();
      set({ playback: 'playing', elapsedMs: from, ...deriveState(config, from) });
      rafId = requestAnimationFrame(tick);
    },

    pause: () => {
      stopLoop();
      set({ playback: 'paused' });
    },

    stepTo: (elapsedMs: number) => {
      stopLoop();
      const clamped = Math.max(0, Math.min(AUCTION_DURATION_MS, elapsedMs));
      const { config } = get();
      set({
        elapsedMs: clamped,
        playback: clamped === 0 ? 'idle' : clamped >= AUCTION_DURATION_MS ? 'completed' : 'paused',
        ...deriveState(config, clamped),
      });
    },

    stepNext: () => {
      const { elapsedMs, phases, phase } = get();
      const currentIndex = phases.indexOf(phase);
      const nextIndex = Math.min(phases.length - 1, currentIndex + 1);
      const target = elapsedForPhase(phases, phases[nextIndex]);
      // Already at the final phase — nothing to advance to.
      const nextElapsed = target > elapsedMs ? target : AUCTION_DURATION_MS;
      get().stepTo(nextElapsed);
    },

    stepBack: () => {
      const { phases, phase } = get();
      const currentIndex = phases.indexOf(phase);
      const prevIndex = Math.max(0, currentIndex - 1);
      get().stepTo(elapsedForPhase(phases, phases[prevIndex]));
    },

    reset: () => {
      stopLoop();
      const { config } = get();
      lastFrameAt = 0;
      set({
        elapsedMs: 0,
        playback: 'idle',
        ...deriveState(config, 0),
        // Node selection and category filtering are view state, not simulation
        // state. Resetting must clear them, otherwise a subsequent click on an
        // already-selected node toggles its detail sheet *closed*.
        selectedNodeId: null,
        isInspectorOpen: false,
        visibleCategories: { ...DEFAULT_CATEGORY_VISIBILITY },
      });
    },

    updateConfig: (patch) => {
      stopLoop();
      const { config } = get();
      const nextConfig: AuctionConfig = {
        ...config,
        ...patch,
        // Any configuration change invalidates the previous run's request id.
        requestNonce:
          patch.requestNonce ?? (patch.floorPrice !== undefined ||
          patch.timeoutMs !== undefined ||
          patch.gdprConsent !== undefined ||
          patch.dealId !== undefined ||
          patch.activeBidders !== undefined
            ? config.requestNonce + 1
            : config.requestNonce),
      };
      set({
        config: nextConfig,
        playback: 'idle',
        elapsedMs: 0,
        // `deriveState` already returns `winningBid`/`verificationReport` for the
        // reset position (both null at t=0); spreading it last keeps a single
        // source of truth instead of duplicating those keys.
        ...deriveState(nextConfig, 0),
      });
    },

    toggleBidder: (bidderId) => {
      const { config } = get();
      const active = config.activeBidders.includes(bidderId);
      const next = active
        ? config.activeBidders.filter((id) => id !== bidderId)
        : [...config.activeBidders, bidderId];
      get().updateConfig({ activeBidders: next });
    },

    setSelectedNodeId: (id) => set({ selectedNodeId: id, isInspectorOpen: id !== null }),

    setInspectorOpen: (open) => set({ isInspectorOpen: open }),

    toggleCategory: (category) => {
      const { visibleCategories } = get();
      set({
        visibleCategories: { ...visibleCategories, [category]: !visibleCategories[category] },
      });
    },
  };
});

export { DEFAULT_CONFIG, AUCTION_DURATION_MS };