/**
 * auctionStore.test.ts — verifies the UI-facing state machine (S-07).
 *
 * The store owns the timeline that every panel subscribes to, so these tests
 * pin the transition rules: forward/backward stepping, boundary conditions,
 * and the fact that a configuration change always resets the simulation.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AUCTION_DURATION_MS, DEFAULT_CONFIG, useAuctionStore } from '@/store/auctionStore';
import { DEMAND_PARTNERS } from '@/mocks/demand-partners';

const store = () => useAuctionStore.getState();

beforeEach(() => {
  // The store is a module-level singleton, so config mutations leak between
  // tests. Restore the full documented default rather than only the time axis,
  // otherwise a floor/timing change from an earlier test silently breaks the next.
  store().updateConfig({ ...DEFAULT_CONFIG, activeBidders: DEMAND_PARTNERS.map((p) => p.bidderId) });
  store().reset();
});

describe('initial state', () => {
  it('starts idle at t=0 with no winner', () => {
    store().reset();
    expect(store().elapsedMs).toBe(0);
    expect(store().phase).toBe('IDLE');
    expect(store().playback).toBe('idle');
    expect(store().winningBid).toBeNull();
    expect(store().verificationReport).toBeNull();
  });

  it('exposes the three Alpha demand partners', () => {
    expect(store().bids).toHaveLength(3);
  });
});

describe('stepTo', () => {
  it('advances the phase to match the elapsed time', () => {
    store().stepTo(130);
    expect(store().phase).toBe('BID_REQUESTS_FIRED');
  });

  it('clamps to the timeline bounds', () => {
    store().stepTo(-500);
    expect(store().elapsedMs).toBe(0);

    store().stepTo(999_999);
    expect(store().elapsedMs).toBe(AUCTION_DURATION_MS);
    expect(store().playback).toBe('completed');
  });

  it('reveals the winning bid only after arbitration', () => {
    store().stepTo(200); // BIDS_COLLECTED — bids collected but not yet arbitrated
    expect(store().winningBid).toBeNull();

    store().stepTo(280); // GAM_ARBITRATION
    expect(store().winningBid?.bidderId).toBe('node-dsp-ttd');
  });

  it('reveals the verification report only at the final phase', () => {
    store().stepTo(280);
    expect(store().verificationReport).toBeNull();

    store().stepTo(AUCTION_DURATION_MS);
    expect(store().verificationReport).not.toBeNull();
  });
});

describe('stepNext / stepBack', () => {
  it('advances one phase at a time', () => {
    const start = store().phase;
    store().stepNext();
    expect(store().phase).not.toBe(start);
    expect(store().phase).toBe('CONSENT_RESOLVED');
  });

  it('walks the full timeline forwards', () => {
    const visited: string[] = [];
    for (let i = 0; i < store().phases.length + 2; i += 1) {
      visited.push(store().phase);
      store().stepNext();
    }
    expect(visited).toContain('AD_RENDERED');
    expect(store().elapsedMs).toBe(AUCTION_DURATION_MS);
  });

  it('returns to IDLE when stepping back from the second phase', () => {
    store().stepNext();
    store().stepBack();
    expect(store().phase).toBe('IDLE');
    expect(store().elapsedMs).toBe(0);
  });

  it('is reversible — stepping back then forward restores the same phase', () => {
    store().stepTo(130);
    const phase = store().phase;
    store().stepBack();
    store().stepNext();
    expect(store().phase).toBe(phase);
  });

  it('does not move backwards past the start', () => {
    store().stepBack();
    store().stepBack();
    expect(store().elapsedMs).toBe(0);
  });
});

describe('updateConfig', () => {
  it('resets the simulation whenever configuration changes', () => {
    store().stepTo(280);
    expect(store().winningBid).not.toBeNull();

    store().updateConfig({ floorPrice: 3 });
    expect(store().elapsedMs).toBe(0);
    expect(store().playback).toBe('idle');
    expect(store().winningBid).toBeNull();
  });

  it('re-derives the phase list when an optional vendor is toggled', () => {
    const before = store().phases.length;
    store().updateConfig({ includeAudience: false });
    expect(store().phases.length).toBe(before - 1);
    expect(store().phases).not.toContain('AUDIENCE_ENRICHED');
  });

  it('bumps the request nonce so each run gets a fresh request id', () => {
    const before = store().config.requestNonce;
    store().updateConfig({ floorPrice: 2 });
    expect(store().config.requestNonce).toBe(before + 1);
  });

  it('raising the floor above every bid clears the winner', () => {
    store().updateConfig({ floorPrice: 10 });
    store().stepTo(AUCTION_DURATION_MS);
    expect(store().winningBid).toBeNull();
  });

  it('withdrawing consent leaves only consent-exempt bidders eligible', () => {
    store().updateConfig({ gdprConsent: false, floorPrice: 1 });
    store().stepTo(AUCTION_DURATION_MS);
    const eligible = store().bids.filter((b) => b.status !== 'no_bid');
    expect(eligible.map((b) => b.bidderId)).toEqual(['node-dsp-amazon']);
  });
});

describe('toggleBidder', () => {
  it('removes a bidder from the auction', () => {
    store().toggleBidder('node-dsp-ttd');
    expect(store().config.activeBidders).not.toContain('node-dsp-ttd');
  });

  it('re-adds a bidder when toggled twice', () => {
    store().toggleBidder('node-dsp-ttd');
    store().toggleBidder('node-dsp-ttd');
    expect(store().config.activeBidders).toContain('node-dsp-ttd');
  });

  it('changes the winner when the top bidder is removed', () => {
    store().toggleBidder('node-dsp-ttd');
    store().stepTo(AUCTION_DURATION_MS);
    expect(store().winningBid?.bidderId).toBe('node-dsp-dv360');
  });
});

describe('packets', () => {
  it('emits no packets during IDLE', () => {
    store().stepTo(0);
    expect(store().packets).toHaveLength(0);
  });

  it('emits bid-request packets once the auction fires', () => {
    store().stepTo(130);
    expect(store().packets.length).toBeGreaterThan(0);
    expect(store().packets.every((p) => p.kind === 'bid-request')).toBe(true);
  });

  it('emits consent packets during the consent phase', () => {
    store().stepTo(50);
    expect(store().packets.every((p) => p.kind === 'consent')).toBe(true);
  });
});

describe('UI selection state', () => {
  it('opening a node sets the selection and opens the inspector', () => {
    store().setSelectedNodeId('node-dsp-ttd');
    expect(store().selectedNodeId).toBe('node-dsp-ttd');
    expect(store().isInspectorOpen).toBe(true);
  });

  it('closing the inspector clears the selection', () => {
    store().setSelectedNodeId('node-dsp-ttd');
    store().setInspectorOpen(false);
    expect(store().isInspectorOpen).toBe(false);
  });

  it('toggles category visibility', () => {
    const before = store().visibleCategories.dsp;
    store().toggleCategory('dsp');
    expect(store().visibleCategories.dsp).toBe(!before);
  });
});