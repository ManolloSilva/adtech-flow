/**
 * openrtb.test.ts — schema validation for the Alpha OpenRTB payloads.
 *
 * Guards the two properties the Inspector and the MSW handlers rely on:
 *   1. Payloads we generate always validate.
 *   2. Payloads we reject produce actionable, path-qualified errors.
 */

import { describe, it, expect } from 'vitest';

import {
  BidRequestSchema,
  BidResponseSchema,
  buildBidRequest,
  buildBidResponse,
  createSyntheticTcfString,
  validatePayload,
} from '@/lib/openrtb';

const BASE = {
  requestId: 'req-1',
  impressionId: 'imp-1',
  bidderCodes: ['ttd', 'dv360', 'amazon'],
  floorPrice: 1.5,
  timeoutMs: 250,
  consentGranted: true,
  includeAudience: true,
  includeIdentity: true,
  seatIds: ['88.0', 'magnite', 'pubmatic', 'openx'],
};

describe('buildBidRequest', () => {
  it('produces a schema-valid BidRequest', () => {
    const result = validatePayload(BidRequestSchema, buildBidRequest(BASE));
    expect(result.valid).toBe(true);
  });

  it('carries the floor and timeout in ext.prebid.config', () => {
    const request = buildBidRequest(BASE);
    expect(request.imp[0].ext?.prebid?.config?.floor).toBe('1.50');
    expect(request.imp[0].ext?.prebid?.config?.timeout).toBe(250);
    expect(request.tmax).toBe(250);
  });

  it('includes both optional first-party data sources when enabled', () => {
    const request = buildBidRequest(BASE);
    const segments = request.imp[0].ext?.prebid?.ortb2?.user?.data ?? [];
    const ids = segments.map((s) => s.id);
    expect(ids).toContain('permutive');
    expect(ids).toContain('liveramp.com');
    expect(ids).toContain('prebid.org');
  });

  it('omits the Permutive segment when the audience vendor is disabled', () => {
    const request = buildBidRequest({ ...BASE, includeAudience: false });
    const ids = (request.imp[0].ext?.prebid?.ortb2?.user?.data ?? []).map((s) => s.id);
    expect(ids).not.toContain('permutive');
    expect(ids).toContain('liveramp.com');
  });

  it('omits the identity segments when identity modules are disabled', () => {
    const request = buildBidRequest({ ...BASE, includeIdentity: false });
    const ids = (request.imp[0].ext?.prebid?.ortb2?.user?.data ?? []).map((s) => s.id);
    expect(ids).not.toContain('liveramp.com');
    expect(ids).toContain('permutive');
  });

  it('omits the user object entirely when consent is withdrawn', () => {
    const request = buildBidRequest({ ...BASE, consentGranted: false });
    expect(request.user).toBeUndefined();
    expect(request.imp[0].ext?.prebid?.consent?.gdpr).toBe(0);
  });

  it('adds a PMP deal when a deal id is supplied', () => {
    const request = buildBidRequest({ ...BASE, dealId: 'DEAL-001' });
    expect(request.pmp?.private_auction).toBe(1);
    expect(request.pmp?.deals?.[0].id).toBe('DEAL-001');
  });

  it('omits pmp when no deal id is supplied', () => {
    expect(buildBidRequest(BASE).pmp).toBeUndefined();
  });

  it('emits a valid schain with one node per supply hop', () => {
    const request = buildBidRequest(BASE);
    expect(request.ext?.schain?.nodes).toHaveLength(BASE.seatIds.length);
    expect(request.ext?.schain?.complete).toBe(1);
  });
});

describe('buildBidResponse', () => {
  const RESPONSE_BASE = {
    bidId: 'node-dsp-ttd-bid',
    impressionId: 'imp-1',
    bidderCode: 'ttd',
    bidderName: 'The Trade Desk',
    cpm: 2.6,
    latencyMs: 140,
  };

  it('produces a schema-valid BidResponse', () => {
    const result = validatePayload(BidResponseSchema, buildBidResponse(RESPONSE_BASE));
    expect(result.valid).toBe(true);
  });

  it('prices the bid in the requested CPM', () => {
    expect(buildBidResponse(RESPONSE_BASE).seatbid?.[0].bid[0].price).toBe(2.6);
  });

  it('marks the winning creative', () => {
    const response = buildBidResponse({ ...RESPONSE_BASE, winning: true });
    expect(response.seatbid?.[0].bid[0].adm).toContain('data-winner="1"');
  });

  it('watermarks the creative as synthetic', () => {
    const response = buildBidResponse(RESPONSE_BASE);
    expect(response.seatbid?.[0].bid[0].adm).toContain('data-adtech-flow="synthetic"');
  });

  it('requires a dealid to be present when supplied', () => {
    const response = buildBidResponse({ ...RESPONSE_BASE, dealId: 'DEAL-001' });
    expect(response.seatbid?.[0].bid[0].dealid).toBe('DEAL-001');
  });

  it('omits dealid for an open-auction bid', () => {
    expect(buildBidResponse(RESPONSE_BASE).seatbid?.[0].bid[0].dealid).toBeUndefined();
  });

  it('surfaces a path-qualified error for a malformed response', () => {
    const result = validatePayload(BidResponseSchema, { id: 'resp-1', seatbid: [{ bid: [] }] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0].path).toContain('seatbid');
      expect(result.errors[0].message).toMatch(/at least one bid/i);
    }
  });
});

describe('BidRequestSchema rejections', () => {
  it('rejects a request with no impressions', () => {
    const result = validatePayload(BidRequestSchema, { id: 'req-1', imp: [] });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0].message).toMatch(/at least one impression/i);
  });

  it('rejects a request with no id', () => {
    const result = validatePayload(BidRequestSchema, { imp: [{ id: 'imp-1', banner: { w: 300, h: 250 } }] });
    expect(result.valid).toBe(false);
  });

  it('rejects an impression with neither banner nor video', () => {
    const result = validatePayload(BidRequestSchema, { id: 'req-1', imp: [{ id: 'imp-1' }] });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0].message).toMatch(/banner or video/i);
  });

  it('rejects a zero-width banner', () => {
    const result = validatePayload(BidRequestSchema, {
      id: 'req-1',
      imp: [{ id: 'imp-1', banner: { w: 0, h: 250 } }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a currency code that is not three characters', () => {
    const result = validatePayload(BidResponseSchema, {
      id: 'resp-1',
      seatbid: [{ bid: [{ id: 'b1', impid: 'imp-1', price: 1, cur: 'DOLLARS' }] }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects an schain with no nodes', () => {
    const result = validatePayload(BidRequestSchema, {
      id: 'req-1',
      imp: [{ id: 'imp-1', banner: { w: 300, h: 250 } }],
      ext: { schain: { complete: 1, nodes: [] } },
    });
    expect(result.valid).toBe(false);
  });
});

describe('createSyntheticTcfString', () => {
  it('starts with the TCF core version marker', () => {
    // Real IAB TCF 2.x core consent strings begin with "C" followed by the
    // encoding version digit and a separator.
    expect(createSyntheticTcfString(true)).toMatch(/^C[A-Z0-9]/);
  });

  it('differs between consented and withdrawn states', () => {
    expect(createSyntheticTcfString(true)).not.toBe(createSyntheticTcfString(false));
  });

  it('returns the same value for the same consent state (deterministic)', () => {
    expect(createSyntheticTcfString(true)).toBe(createSyntheticTcfString(true));
    expect(createSyntheticTcfString(false)).toBe(createSyntheticTcfString(false));
  });
});