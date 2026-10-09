/**
 * mocks/handlers.ts — MSW request handlers for the synthetic ad-tech network.
 *
 * Every outbound call the auction engine makes is intercepted here. Nothing in
 * this file ever reaches a real SSP, DSP, or ad server:
 *
 *   POST /openrtb2/auction/:sspCode   → synthetic OpenRTB 2.5 BidResponse
 *   POST /api/consent/tcf             → synthetic TCF v2.2 consent signal
 *   POST /api/identity/sync           → synthetic ramp-id envelope
 *   POST /api/audience/segments       → synthetic Seller-Defined Audience segments
 *   POST /api/verification/measure    → synthetic IAS post-bid report
 *
 * The handlers behave *according to the request*, so floor enforcement,
 * timeout, consent withdrawal, and PMP deal restriction are simulated server-side
 * exactly as a real SSP would behave.
 */

import { http, HttpResponse, delay } from 'msw';

import { BidRequestSchema, buildBidResponse, createSyntheticTcfString } from '@/lib/openrtb';
import { DEMAND_PARTNERS } from './demand-partners';

/** Maps an SSP domain node id to the bidder code used by Prebid adapters. */
const SSP_ROUTES: Record<string, { code: string; host: string }> = {
  'node-ssp-magnite': { code: 'magnite', host: 'magnite.com' },
  'node-ssp-pubmatic': { code: 'pubmatic', host: 'pubmatic.com' },
  'node-ssp-openx': { code: 'openx', host: 'openx.com' },
};

/** Deterministic fake latency jitter so the simulation is reproducible. */
function jitterFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 30;
}

export const handlers = [
  /* ---------------------------------------------------------------------- */
  /* Bid request → bid response                                              */
  /* ---------------------------------------------------------------------- */
  http.post('/openrtb2/auction/:sspCode', async ({ params, request }) => {
    const sspCode = String(params.sspCode);
    const route = Object.entries(SSP_ROUTES).find(([, r]) => r.code === sspCode);
    const partners = DEMAND_PARTNERS.filter((p) => {
      const r = Object.entries(SSP_ROUTES).find(([id]) => id === p.sspId);
      return r?.[1].code === sspCode;
    });

    // Unknown SSP: behave like a 404 rather than silently succeeding.
    if (!route || partners.length === 0) {
      return HttpResponse.json({ error: `Unknown SSP adapter: ${sspCode}` }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = BidRequestSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        {
          error: 'invalid_openrtb',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 400 },
      );
    }

    const bidRequest = parsed.data;
    const imp = bidRequest.imp[0];
    const prebid = imp.ext?.prebid;
    const timeoutMs = prebid?.config?.timeout ?? bidRequest.tmax ?? 300;
    const floorPrice = Number.parseFloat(prebid?.config?.floor ?? '0');
    const consentGranted = prebid?.consent?.gdpr !== 0;

    const dealId = bidRequest.pmp?.deals?.[0]?.id;
    const privateAuction = bidRequest.pmp?.private_auction === 1;

    for (const partner of partners) {
      const jitter = jitterFor(`${partner.bidderId}:${bidRequest.id}`);
      const latency = partner.latencyMs + jitter;
      // `delay` uses real timers — in tests the engine does not await these.
      await delay(Math.min(latency, 60));

      /* --- Hard timeout: bid never reaches the seller in time. --------- */
      if (latency > timeoutMs) {
        continue;
      }

      /* --- Consent withdrawn: bidder refuses to bid. -------------------- */
      if (partner.requiresConsent && !consentGranted) {
        continue;
      }

      /* --- PMP private auction: only deal holders may bid. -------------- */
      if (privateAuction && partner.dealId && partner.dealId !== dealId) {
        continue;
      }

      /* --- Deal-holder with no matching deal opts out entirely. ---------- */
      if (dealId && partner.dealId !== dealId) {
        continue;
      }

      /* --- Floor enforcement: bids under the floor are discarded. ------- */
      if (partner.baseCpm < floorPrice) {
        continue;
      }

      return HttpResponse.json(
        buildBidResponse({
          bidId: `${partner.bidderId}-bid`,
          impressionId: imp.id,
          bidderCode: partner.bidderId.replace('node-dsp-', ''),
          bidderName: partner.name,
          cpm: partner.baseCpm,
          latencyMs: latency,
          ...(dealId && partner.dealId === dealId ? { dealId } : {}),
        }),
        {
          headers: {
            'x-adx-bidder': partner.bidderId,
            'x-adx-latency-ms': String(latency),
            'x-adtech-flow': 'synthetic-simulation',
          },
        },
      );
    }

    // No bidder returned an eligible bid (204 No Content, per OpenRTB 2.5).
    return new HttpResponse(null, { status: 204 });
  }),

  /* ---------------------------------------------------------------------- */
  /* CMP — TCF v2.2 consent signal                                           */
  /* ---------------------------------------------------------------------- */
  http.post('/api/consent/tcf', async ({ request }) => {
    const body = (await request.json()) as { granted?: boolean };
    const granted = body.granted !== false;
    await delay(20);
    return HttpResponse.json({
      tcf: createSyntheticTcfString(granted),
      gdpr: 1,
      us_privacy: '1YNN',
      gpp: '2.2',
      gpp_sid: ['8.CABaseConsentString'],
      tcfPolicyVersion: '2.2',
      purposeConsents: granted
        ? [1, 2, 3, 4, 7]
        : [1, 2],
      vendorConsents: granted
        ? { '55': true, '157': true, '175': true, '301': true }
        : { '55': false, '157': false, '175': false, '301': false },
      synthetic: true,
    });
  }),

  /* ---------------------------------------------------------------------- */
  /* Identity module sync                                                    */
  /* ---------------------------------------------------------------------- */
  http.post('/api/identity/sync', async ({ request }) => {
    const body = (await request.json()) as { modules?: string[] };
    await delay(25);
    const modules = body.modules ?? ['liveramp', 'sharedid'];
    return HttpResponse.json({
      ids: modules.map((module) => ({
        module,
        envelopeId: `env-${module}-synthetic-7f3a9c21`,
        expiresInDays: 90,
      })),
      synthetic: true,
    });
  }),

  /* ---------------------------------------------------------------------- */
  /* Audience — Seller-Defined Audience segments                             */
  /* ---------------------------------------------------------------------- */
  http.post('/api/audience/segments', async () => {
    await delay(15);
    return HttpResponse.json({
      provider: 'permutive.com',
      segments: [
        { id: 'sda-9f2c', name: 'Returning sports reader', size: '3-5M' },
        { id: 'sda-44b1', name: 'High-intent tech cohort', size: '500K-1M' },
      ],
      synthetic: true,
    });
  }),

  /* ---------------------------------------------------------------------- */
  /* IAS post-bid verification                                               */
  /* ---------------------------------------------------------------------- */
  http.post('/api/verification/measure', async ({ request }) => {
    const body = (await request.json()) as { cpm?: number; creative?: string };
    await delay(35);
    // Higher CPM correlates with premium inventory → better viewability and safety.
    const cpm = body.cpm ?? 2;
    const viewability = Math.min(96, Math.round(62 + cpm * 11));
    const ivtRate = cpm < 1 ? 4.2 : 1.1;
    return HttpResponse.json({
      vendor: 'Integral Ad Science',
      viewabilityScore: viewability,
      viewable: viewability >= 70,
      measurementStandard: 'MRC / OMID',
      ivtRate,
      ivtClassification: ivtRate > 2 ? 'SUSPICIOUS' : 'CLEAN',
      brandSafetyStatus: cpm >= 2 ? 'SAFE' : 'FLAGGED',
      creativeScanned: body.creative ?? 'simulated-creative',
      synthetic: true,
    });
  }),
];