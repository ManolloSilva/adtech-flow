/**
 * auction-engine.test.ts — unit tests for the deterministic auction engine.
 *
 * These are pure-function tests: no React, no network, no timers. They pin the
 * behaviour the UI depends on (floor enforcement, timeout, consent, PMP, and
 * winner selection) so a refactor cannot silently change auction semantics.
 */

import { describe, it, expect } from 'vitest';

import {
  AUCTION_DURATION_MS,
  PHASE_SCHEDULE,
  activePhasesFor,
  allPackets,
  applyArbitration,
  deriveVerificationReport,
  evaluateBid,
  packetsForPhase,
  phaseAtElapsed,
  runAuction,
  selectWinner,
} from '@/auction/auction-engine';
import { DEMAND_PARTNERS } from '@/mocks/demand-partners';
import type { AuctionConfig } from '@/types';

const BASE_CONFIG: AuctionConfig = {
  floorPrice: 1.5,
  timeoutMs: 250,
  gdprConsent: true,
  activeBidders: DEMAND_PARTNERS.map((p) => p.bidderId),
  includeAudience: true,
  includeIdentity: true,
  includeVerification: true,
  requestNonce: 1,
};

const TTD = DEMAND_PARTNERS.find((p) => p.bidderId === 'node-dsp-ttd')!;
const DV360 = DEMAND_PARTNERS.find((p) => p.bidderId === 'node-dsp-dv360')!;
const AMAZON = DEMAND_PARTNERS.find((p) => p.bidderId === 'node-dsp-amazon')!;

describe('activePhasesFor', () => {
  it('includes every phase when all optional vendors are enabled', () => {
    expect(activePhasesFor(BASE_CONFIG)).toHaveLength(PHASE_SCHEDULE.length);
  });

  it('drops the audience phase when Permutive is disabled', () => {
    const phases = activePhasesFor({ ...BASE_CONFIG, includeAudience: false });
    expect(phases).not.toContain('AUDIENCE_ENRICHED');
    expect(phases).toContain('ID_MODULES_LOADED');
  });

  it('drops the identity phase when identity modules are disabled', () => {
    const phases = activePhasesFor({ ...BASE_CONFIG, includeIdentity: false });
    expect(phases).not.toContain('ID_MODULES_LOADED');
  });

  it('drops the verification phase when IAS is disabled', () => {
    const phases = activePhasesFor({ ...BASE_CONFIG, includeVerification: false });
    expect(phases).not.toContain('VERIFICATION_MEASURED');
    expect(phases).toContain('AD_RENDERED');
  });

  it('always keeps the mandatory phases regardless of configuration', () => {
    const phases = activePhasesFor({
      ...BASE_CONFIG,
      includeAudience: false,
      includeIdentity: false,
      includeVerification: false,
    });
    for (const mandatory of [
      'IDLE',
      'CONSENT_RESOLVED',
      'BID_REQUESTS_FIRED',
      'BIDS_COLLECTED',
      'TIMEOUT_APPLIED',
      'GAM_ARBITRATION',
      'AD_RENDERED',
    ]) {
      expect(phases).toContain(mandatory);
    }
  });
});

describe('phaseAtElapsed', () => {
  it('returns IDLE at t=0', () => {
    expect(phaseAtElapsed(BASE_CONFIG, 0)).toBe('IDLE');
  });

  it('never regresses — phases are monotonic in time', () => {
    let previousIndex = -1;
    for (let ms = 0; ms <= AUCTION_DURATION_MS; ms += 5) {
      const phase = phaseAtElapsed(BASE_CONFIG, ms);
      const index = PHASE_SCHEDULE.findIndex((p) => p.phase === phase);
      expect(index).toBeGreaterThanOrEqual(previousIndex);
      previousIndex = index;
    }
  });

  it('reaches the final phase at the end of the timeline', () => {
    expect(phaseAtElapsed(BASE_CONFIG, AUCTION_DURATION_MS)).toBe('VERIFICATION_MEASURED');
  });

  it('skips disabled phases when resolving time', () => {
    const config = { ...BASE_CONFIG, includeAudience: false };
    // Disabling a phase removes it from the schedule without shifting the
    // remaining phases, so the identity phase still starts at its own 95ms mark.
    // At 70ms — the audience phase's timestamp — the active phase is still consent.
    expect(phaseAtElapsed(config, 70)).toBe('CONSENT_RESOLVED');
    expect(phaseAtElapsed(config, 95)).toBe('ID_MODULES_LOADED');
  });
});

describe('evaluateBid', () => {
  it('accepts a bid that clears both floor and timeout', () => {
    expect(evaluateBid(TTD, BASE_CONFIG).status).toBe('submitted');
  });

  it('rejects a bid below the floor', () => {
    const result = evaluateBid(AMAZON, { ...BASE_CONFIG, floorPrice: 2 });
    expect(result.status).toBe('below_floor');
    expect(result.reason).toMatch(/floor/i);
  });

  it('rejects a bid that exceeds the auction timeout', () => {
    const result = evaluateBid(DV360, { ...BASE_CONFIG, timeoutMs: 150 });
    expect(result.status).toBe('timed_out');
    expect(result.reason).toMatch(/tmax/i);
  });

  it('drops bidders that require consent when consent is withdrawn', () => {
    const result = evaluateBid(TTD, { ...BASE_CONFIG, gdprConsent: false });
    expect(result.status).toBe('no_bid');
    expect(result.reason).toMatch(/consent/i);
  });

  it('still bids for a bidder that does not require consent when consent is withdrawn', () => {
    // Amazon DSP does not require consent (see mocks/demand-partners.ts).
    // The floor is lowered to 1.00 so this assertion isolates the consent rule:
    // Amazon's $1.25 CPM is below the default $1.50 floor, which would otherwise
    // mask the consent outcome with a floor rejection.
    expect(AMAZON.requiresConsent).toBe(false);
    const result = evaluateBid(AMAZON, { ...BASE_CONFIG, gdprConsent: false, floorPrice: 1 });
    expect(result.status).toBe('submitted');
  });

  it('drops bidders that are not in the active list', () => {
    const config = { ...BASE_CONFIG, activeBidders: ['node-dsp-ttd'] };
    const result = evaluateBid(DV360, config);
    expect(result.status).toBe('no_bid');
    expect(result.reason).toMatch(/deactivated/i);
  });

  it('restricts a PMP private auction to the deal holder', () => {
    const withDeal = { ...TTD, dealId: 'DEAL-001' };
    const partner = { ...withDeal };
    const result = evaluateBid(partner, { ...BASE_CONFIG, dealId: 'DEAL-001' });
    expect(result.status).toBe('submitted');

    const other = evaluateBid(DV360, { ...BASE_CONFIG, dealId: 'DEAL-001' });
    expect(other.status).toBe('no_bid');
    expect(other.reason).toMatch(/deal holder/i);
  });
});

describe('selectWinner', () => {
  it('picks the highest eligible CPM', () => {
    const bids = [
      { ...evaluateBid(DV360, BASE_CONFIG), status: 'submitted' as const },
      { ...evaluateBid(TTD, BASE_CONFIG), status: 'submitted' as const },
    ];
    expect(selectWinner(bids)?.bidderId).toBe('node-dsp-ttd');
  });

  it('ignores bids that were rejected', () => {
    const bids = [
      { ...evaluateBid(TTD, BASE_CONFIG), status: 'timed_out' as const },
      { ...evaluateBid(DV360, BASE_CONFIG), status: 'submitted' as const },
    ];
    expect(selectWinner(bids)?.bidderId).toBe('node-dsp-dv360');
  });

  it('returns null when no bid is eligible', () => {
    const bids = DEMAND_PARTNERS.map((p) => ({ ...evaluateBid(p, BASE_CONFIG), status: 'below_floor' as const }));
    expect(selectWinner(bids)).toBeNull();
  });

  it('breaks CPM ties on the lower latency', () => {
    const slow = { ...evaluateBid(TTD, BASE_CONFIG), cpm: 2, latencyMs: 200 };
    const fast = { ...evaluateBid(DV360, BASE_CONFIG), cpm: 2, latencyMs: 50 };
    expect(selectWinner([slow, fast])?.bidderId).toBe('node-dsp-dv360');
  });
});

describe('applyArbitration', () => {
  it('marks the winner as won and every other eligible bid as lost', () => {
    const bids = DEMAND_PARTNERS.map((p) => evaluateBid(p, BASE_CONFIG));
    const result = applyArbitration(bids);
    const winners = result.bids.filter((b) => b.status === 'won');
    expect(winners).toHaveLength(1);
    expect(result.winningBid?.bidderId).toBe('node-dsp-ttd');
  });

  it('leaves rejected bids untouched', () => {
    const bids = DEMAND_PARTNERS.map((p) => evaluateBid(p, { ...BASE_CONFIG, floorPrice: 3 }));
    const result = applyArbitration(bids);
    expect(result.bids.every((b) => b.status === 'below_floor')).toBe(true);
    expect(result.winningBid).toBeNull();
  });
});

describe('packetsForPhase', () => {
  it('emits a consent packet on the CMP phase', () => {
    const packets = packetsForPhase('CONSENT_RESOLVED', BASE_CONFIG);
    expect(packets).toHaveLength(1);
    expect(packets[0].kind).toBe('consent');
  });

  it('emits request and response packets for both auction phases', () => {
    const requests = packetsForPhase('BID_REQUESTS_FIRED', BASE_CONFIG);
    // 3 bidders × (wrapper hop + SSP→DSP hop)
    expect(requests).toHaveLength(6);
    expect(requests.every((p) => p.kind === 'bid-request')).toBe(true);

    const responses = packetsForPhase('BIDS_COLLECTED', BASE_CONFIG);
    expect(responses).toHaveLength(6);
    expect(responses.every((p) => p.kind === 'bid-response')).toBe(true);
  });

  it('emits no audience packets when Permutive is disabled', () => {
    expect(packetsForPhase('AUDIENCE_ENRICHED', { ...BASE_CONFIG, includeAudience: false })).toHaveLength(0);
  });

  it('emits two identity packets when identity modules are enabled', () => {
    expect(packetsForPhase('ID_MODULES_LOADED', BASE_CONFIG)).toHaveLength(2);
  });

  it('emits no verification packet when IAS is disabled', () => {
    expect(
      packetsForPhase('VERIFICATION_MEASURED', { ...BASE_CONFIG, includeVerification: false }),
    ).toHaveLength(0);
  });

  it('emits no packets during IDLE', () => {
    expect(packetsForPhase('IDLE', BASE_CONFIG)).toHaveLength(0);
  });

  it('only emits packets whose endpoints exist in the ecosystem graph', () => {
    // Guards against typos in node ids producing invisible animation.
    const known = new Set([
      'node-pub-nytimes',
      'node-cmp-onetrust',
      'node-audience-permutive',
      'node-id-liveramp',
      'node-id-sharedid',
      'node-adserver-gam',
      'node-verification-ias',
      'node-ssp-magnite',
      'node-ssp-pubmatic',
      'node-ssp-openx',
      'node-dsp-ttd',
      'node-dsp-dv360',
      'node-dsp-amazon',
    ]);
    for (const packet of allPackets(BASE_CONFIG)) {
      expect(known, `unknown source ${packet.source}`).toContain(packet.source);
      expect(known, `unknown target ${packet.target}`).toContain(packet.target);
    }
  });
});

describe('deriveVerificationReport', () => {
  it('returns null when IAS is disabled', () => {
    expect(deriveVerificationReport(2.6, { ...BASE_CONFIG, includeVerification: false })).toBeNull();
  });

  it('flags a low CPM as brand-unsafe', () => {
    const report = deriveVerificationReport(0.8, BASE_CONFIG)!;
    expect(report.brandSafetyStatus).toBe('FLAGGED');
  });

  it('flags a low CPM as suspicious for IVT', () => {
    const report = deriveVerificationReport(0.8, BASE_CONFIG)!;
    expect(report.ivtClassification).toBe('SUSPICIOUS');
  });

  it('marks a premium CPM as safe and clean', () => {
    const report = deriveVerificationReport(2.6, BASE_CONFIG)!;
    expect(report.brandSafetyStatus).toBe('SAFE');
    expect(report.ivtClassification).toBe('CLEAN');
    expect(report.viewable).toBe(true);
  });
});

describe('runAuction', () => {
  it('produces the same result for the same configuration (determinism)', () => {
    const a = runAuction(BASE_CONFIG);
    const b = runAuction(BASE_CONFIG);
    expect(a.bids).toEqual(b.bids);
    expect(a.winningBid).toEqual(b.winningBid);
    expect(JSON.stringify(a.lastRequest)).toBe(JSON.stringify(b.lastRequest));
  });

  it('selects the expected winner under the default configuration', () => {
    expect(runAuction(BASE_CONFIG).winningBid?.bidderId).toBe('node-dsp-ttd');
  });

  it('changes the winner when the floor rises above the top bid', () => {
    const result = runAuction({ ...BASE_CONFIG, floorPrice: 10 });
    expect(result.winningBid).toBeNull();
  });

  it('generates an OpenRTB-valid BidRequest', () => {
    // runAuction throws if the generated request fails validation, so reaching
    // this assertion already proves schema validity; we assert structure too.
    const request = runAuction(BASE_CONFIG).lastRequest!;
    expect(request.id).toMatch(/^req-/);
    expect(request.imp).toHaveLength(1);
    expect(request.imp[0].ext?.prebid?.config?.floor).toBe('1.50');
    expect(request.tmax).toBe(250);
  });

  it('omits the user object when consent is withdrawn', () => {
    const request = runAuction({ ...BASE_CONFIG, gdprConsent: false }).lastRequest!;
    expect(request.user).toBeUndefined();
    expect(request.imp[0].ext?.prebid?.consent?.gdpr).toBe(0);
  });

  it('adds a pmp object when a deal id is configured', () => {
    const request = runAuction({ ...BASE_CONFIG, dealId: 'DEAL-001' }).lastRequest!;
    expect(request.pmp?.private_auction).toBe(1);
    expect(request.pmp?.deals?.[0].id).toBe('DEAL-001');
  });

  it('produces no verification report when IAS is disabled', () => {
    expect(
      runAuction({ ...BASE_CONFIG, includeVerification: false }).verificationReport,
    ).toBeNull();
  });
});