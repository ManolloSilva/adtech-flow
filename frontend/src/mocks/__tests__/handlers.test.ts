/**
 * handlers.test.ts — verifies the MSW layer is a total network boundary.
 *
 * Critical property (product-spec.md §7): every ad-tech call is intercepted and
 * no live endpoint is ever contacted. `setup.ts` configures MSW with
 * `onUnhandledRequest: 'error'`, so any request these tests make that is *not*
 * handled here fails the test rather than escaping to the network.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/mocks/server';
import { buildBidRequest } from '@/lib/openrtb';
import { DEMAND_PARTNERS } from '@/mocks/demand-partners';

const SSP_CODES = { magnite: 'node-ssp-magnite', pubmatic: 'node-ssp-pubmatic', openx: 'node-ssp-openx' };

function requestFor(overrides: Record<string, unknown> = {}) {
  return buildBidRequest({
    requestId: 'req-test',
    impressionId: 'imp-1',
    bidderCodes: ['ttd'],
    floorPrice: 1.5,
    timeoutMs: 250,
    consentGranted: true,
    includeAudience: true,
    includeIdentity: true,
    seatIds: ['88.0'],
    ...overrides,
  });
}

async function postAuction(sspCode: string, body: unknown) {
  const response = await fetch(`/openrtb2/auction/${sspCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response;
}

describe('bid request endpoint', () => {
  it('returns a bid for the DSP wired to that SSP', async () => {
    const response = await postAuction('magnite', requestFor());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.seatbid[0].bid[0].price).toBeGreaterThan(0);
  });

  it('advertises the bidder and latency in response headers', async () => {
    const response = await postAuction('magnite', requestFor());
    expect(response.headers.get('x-adx-bidder')).toBe('node-dsp-ttd');
    expect(response.headers.get('x-adx-latency-ms')).toBeTruthy();
  });

  it('marks the response as a synthetic simulation', async () => {
    const response = await postAuction('magnite', requestFor());
    expect(response.headers.get('x-adtech-flow')).toBe('synthetic-simulation');
  });

  it('returns 404 for an unknown SSP adapter', async () => {
    const response = await postAuction('not-an-ssp', requestFor());
    expect(response.status).toBe(404);
  });

  it('returns 400 with path-qualified issues for a malformed payload', async () => {
    const response = await postAuction('magnite', { id: 'req-test', imp: [] });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_openrtb');
    expect(body.issues[0].path).toBeDefined();
  });
});

describe('floor enforcement', () => {
  it('returns 204 No Content when every bid is under the floor', async () => {
    const response = await postAuction('magnite', requestFor({ floorPrice: 10 }));
    expect(response.status).toBe(204);
  });

  it('still returns a bid when the floor is low', async () => {
    const response = await postAuction('magnite', requestFor({ floorPrice: 1 }));
    expect(response.status).toBe(200);
  });
});

describe('timeout enforcement', () => {
  it('returns 204 when the timeout is shorter than the bidder latency', async () => {
    const response = await postAuction('magnite', requestFor({ timeoutMs: 50 }));
    expect(response.status).toBe(204);
  });
});

describe('consent enforcement', () => {
  it('returns 204 when consent is withdrawn for a consent-requiring DSP', async () => {
    const response = await postAuction('magnite', requestFor({ consentGranted: false, floorPrice: 0.5 }));
    expect(response.status).toBe(204);
  });
});

describe('CMP consent endpoint', () => {
  it('returns a TCF string and per-vendor consents when granted', async () => {
    const response = await fetch('/api/consent/tcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ granted: true }),
    });
    const body = await response.json();
    expect(body.tcf).toMatch(/^C/);
    expect(body.vendorConsents['55']).toBe(true);
  });

  it('returns revoked per-vendor consents when withdrawn', async () => {
    const response = await fetch('/api/consent/tcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ granted: false }),
    });
    const body = await response.json();
    expect(body.vendorConsents['55']).toBe(false);
  });
});

describe('identity sync endpoint', () => {
  it('returns an envelope id per requested module', async () => {
    const response = await fetch('/api/identity/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules: ['liveramp', 'sharedid'] }),
    });
    const body = await response.json();
    expect(body.ids).toHaveLength(2);
    expect(body.ids[0].envelopeId).toMatch(/^env-/);
  });
});

describe('audience segments endpoint', () => {
  it('returns seller-defined audience segments', async () => {
    const response = await fetch('/api/audience/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await response.json();
    expect(body.provider).toBe('permutive.com');
    expect(body.segments.length).toBeGreaterThan(0);
  });
});

describe('verification endpoint', () => {
  it('reports better viewability for a higher CPM', async () => {
    const premium = await (
      await fetch('/api/verification/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpm: 3 }),
      })
    ).json();
    const entry = await (
      await fetch('/api/verification/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpm: 0.5 }),
      })
    ).json();

    expect(premium.viewabilityScore).toBeGreaterThan(entry.viewabilityScore);
    expect(premium.brandSafetyStatus).toBe('SAFE');
    expect(entry.brandSafetyStatus).toBe('FLAGGED');
    expect(entry.ivtClassification).toBe('SUSPICIOUS');
  });
});

describe('network containment', () => {
  it('every demand partner maps to a known SSP route', () => {
    for (const partner of DEMAND_PARTNERS) {
      const code = partner.sspId.replace('node-ssp-', '');
      expect(
        Object.keys(SSP_CODES),
        `unmapped SSP "${code}" for ${partner.bidderId}`,
      ).toContain(code);
    }
  });

  it('routes every demand partner to a bid response', async () => {
    for (const partner of DEMAND_PARTNERS) {
      const code = partner.sspId.replace('node-ssp-', '');
      const response = await postAuction(code, requestFor({ floorPrice: 0, timeoutMs: 500 }));
      expect(response.status, `${partner.name} did not receive a bid`).toBe(200);
    }
  });

  it('intercepts a request when handlers are overridden per-test', async () => {
    server.use(
      http.post('/openrtb2/auction/magnite', () =>
        HttpResponse.json({ id: 'override', seatbid: [] }, { status: 200 }),
      ),
    );
    const response = await postAuction('magnite', requestFor());
    expect((await response.json()).id).toBe('override');
  });
});