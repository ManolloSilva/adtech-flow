/**
 * openrtb.ts — OpenRTB 2.5 / 3.0 schemas (Zod) and builders.
 *
 * The Alpha slice models OpenRTB 2.5 because it is the wire format that
 * header bidding wrappers (Prebid.js) actually speak. OpenRTB 3.0 is captured
 * structurally via the `ortb2` extension field in the BidRequest.
 *
 * All payloads produced here are synthetic and watermarked. They must never be
 * sent to a live ad server.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Core objects                                                                */
/* -------------------------------------------------------------------------- */

export const ImpBannerSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  format: z.array(z.tuple([z.number().int().positive(), z.number().int().positive()])).optional(),
  topframe: z.number().int().min(0).optional(),
});

export const ImpVideoSchema = z.object({
  mimes: z.array(z.string()),
  w: z.number().int().positive().optional(),
  h: z.number().int().positive().optional(),
});

export const SupplyChainNodeSchema = z.object({
  si: z.string().min(1, 'schain node must include si (seller id)'),
  hp: z.number().int().min(0).max(1).optional(),
  name: z.string().optional(),
  domain: z.string().optional(),
});

export const SupplyChainSchema = z.object({
  complete: z.number().int().min(0).max(1).optional(),
  nodes: z.array(SupplyChainNodeSchema).min(1, 'schain must contain at least one node'),
});

export type SupplyChain = z.infer<typeof SupplyChainSchema>;

export const UserDataEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  segment: z.array(z.string()),
  ext: z.record(z.string(), z.unknown()).optional(),
  consent: z.string().optional(),
  /** Seller-Defined Audience signal (Permutive → ortb2.user.data) */
  provider: z.string().optional(),
});

export const ImpExtPrebidSchema = z.object({
  bidder: z.record(
    z.string(),
    z.object({
      adapter: z.string().optional(),
      targeting: z.record(z.string(), z.string()).optional(),
    }),
  ),
  ortb2: z
    .object({
      imp: z.array(z.unknown()).optional(),
      site: z.object({ content: z.unknown() }).passthrough().optional(),
      user: z.object({ data: z.array(UserDataEntrySchema) }).passthrough().optional(),
      regs: z.object({ ext: z.record(z.string(), z.unknown()).optional() }).passthrough().optional(),
      pmp: z.object({ private_auction: z.number().optional(), deals: z.array(z.unknown()) }).passthrough().optional(),
      fsk: z.string().optional(),
      gpid: z.string().optional(),
    })
    .optional(),
  config: z
    .object({
      timeout: z.number().int().positive().optional(),
      floor: z.string().optional(),
    })
    .optional(),
  consent: z
    .object({
      tcf: z.string().optional(),
      gdpr: z.number().int().min(0).max(1).optional(),
      us_privacy: z.string().optional(),
      gpp: z.string().optional(),
    })
    .optional(),
  targeting: z.record(z.string(), z.string()).optional(),
  data: z.record(z.string(), z.string()).optional(),
  skadn: z.record(z.string(), z.unknown()).optional(),
  schain: SupplyChainSchema.optional(),
});

export const ImpExtSchema = z.object({
  prebid: ImpExtPrebidSchema.optional(),
});

export const ImpSchema = z.object({
  id: z.string().min(1, 'imp.id is required'),
  tagid: z.string().optional(),
  banner: ImpBannerSchema.optional(),
  video: ImpVideoSchema.optional(),
  ext: ImpExtSchema.optional(),
  // Guard: at least one creative format must be present.
}).refine((imp) => imp.banner !== undefined || imp.video !== undefined, {
  message: 'imp must declare at least one of banner or video',
});

export const SiteSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  domain: z.string().optional(),
  cat: z.array(z.string()).optional(),
  page: z.string().optional(),
  publisher: z.object({ id: z.string().optional(), domain: z.string().optional(), name: z.string().optional() }).optional(),
  content: z.object({ id: z.string().optional(), episode: z.number().optional(), title: z.string().optional() }).passthrough().optional(),
});

export const UserDataSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  buyeruid: z.string().optional(),
  data: z.array(UserDataEntrySchema).optional(),
  ext: z.record(z.string(), z.unknown()).optional(),
});

export const RegsSchema = z.object({
  coppa: z.number().int().min(0).max(1).optional(),
  ext: z.record(z.string(), z.unknown()).optional(),
});

export const PmpDealSchema = z.object({
  id: z.string().min(1),
  bidfloor: z.number().min(0).optional(),
  bidfloorcur: z.string().optional(),
  wseat: z.array(z.string()).optional(),
  wlang: z.array(z.string()).optional(),
  at: z.number().int().min(0).optional(),
  ext: z.record(z.string(), z.unknown()).optional(),
});

export const PmpSchema = z.object({
  private_auction: z.number().int().min(0).max(1).optional(),
  deals: z.array(PmpDealSchema).optional(),
});

export const BidRequestExtSchema = z.object({
  schain: SupplyChainSchema.optional(),
  gpp: z.string().optional(),
  gpp_sid: z.array(z.string()).optional(),
  prebid: z.record(z.string(), z.unknown()).optional(),
});

/** OpenRTB 2.5 BidRequest */
export const BidRequestSchema = z.object({
  id: z.string().min(1, 'id is required'),
  imp: z.array(ImpSchema).min(1, 'at least one impression is required'),
  site: SiteSchema.optional(),
  user: UserDataSchema.optional(),
  device: z.record(z.string(), z.unknown()).optional(),
  tmax: z.number().int().min(0).optional(),
  regs: RegsSchema.optional(),
  bcat: z.array(z.string()).optional(),
  badv: z.array(z.string()).optional(),
  pmp: PmpSchema.optional(),
  ext: BidRequestExtSchema.optional(),
});

export const BidSchemaInner = z.object({
  id: z.string().min(1),
  impid: z.string().min(1, 'bid.impid must reference an imp.id'),
  price: z.number().min(0),
  cur: z.string().length(3, 'ISO-4217 currency code'),
  w: z.number().int().positive().optional(),
  h: z.number().int().positive().optional(),
  adm: z.string().optional(),
  adomain: z.array(z.string()).optional(),
  cpid: z.string().optional(),
  cid: z.string().optional(),
  dealid: z.string().optional(),
  mtype: z.number().int().min(1).max(4).optional(),
  ext: z.record(z.string(), z.unknown()).optional(),
});

export const SeatBidSchema = z.object({
  bid: z.array(BidSchemaInner).min(1, 'seatbid must contain at least one bid'),
  seat: z.string().optional(),
  group: z.number().int().min(0).max(1).optional(),
});

/** OpenRTB 2.5 BidResponse */
export const BidResponseSchema = z.object({
  id: z.string().min(1, 'id is required'),
  seatbid: z.array(SeatBidSchema).optional(),
  bidid: z.string().optional(),
  cur: z.string().length(3).optional(),
  ext: z.record(z.string(), z.unknown()).optional(),
});

export type BidRequest = z.infer<typeof BidRequestSchema>;
export type BidResponse = z.infer<typeof BidResponseSchema>;
export type Imp = z.infer<typeof ImpSchema>;
export type ImpExtPrebid = z.infer<typeof ImpExtPrebidSchema>;
export type Pmp = z.infer<typeof PmpSchema>;

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A synthetic, watermarked TCF v2.2 consent string.
 * Real IAB TCF 2.x core consent strings begin with `C` + encoding version
 * (e.g. `COvFyGBOvFyGBAbAAAENAPC…`). The value below matches that shape so the
 * payload is structurally plausible, but it is semantically meaningless filler.
 * It MUST NOT be used for real ad serving.
 */
export function createSyntheticTcfString(vendorConsented: boolean): string {
  const base = 'CQCUKK1CQCUKK1AHABBENAvCIAUAAAABAAKABEwA8Jg';
  return vendorConsented ? `${base}BENAVAAPCgAMAAPA` : `${base}BENABAAAAAAMAA`;
}

export interface BuildRequestOptions {
  requestId: string;
  impressionId: string;
  bidderCodes: string[];
  floorPrice: number;
  timeoutMs: number;
  consentGranted: boolean;
  includeAudience: boolean;
  includeIdentity: boolean;
  dealId?: string;
  seatIds: string[];
}

/** Builds the OpenRTB 2.5 BidRequest Prebid would POST to an SSP endpoint. */
export function buildBidRequest(options: BuildRequestOptions): BidRequest {
  const {
    requestId,
    impressionId,
    bidderCodes,
    floorPrice,
    timeoutMs,
    consentGranted,
    includeAudience,
    includeIdentity,
    dealId,
    seatIds,
  } = options;

  const schain: SupplyChain = {
    complete: 1,
    nodes: seatIds.map((si) => ({ si, hp: 1 })),
  };

  const extPrebid: ImpExtPrebid = {
    bidder: Object.fromEntries(bidderCodes.map((code) => [code, { adapter: code }])),
    ortb2: {
      site: { content: { id: 'article-4821', episode: 12, title: 'Inside the OpenRTB Auction' } },
      regs: { ext: { gpp: '2.2', gpp_sid: ['8.CABaseConsentString'] } },
    },
    config: {
      timeout: timeoutMs,
      floor: floorPrice.toFixed(2),
    },
    consent: {
      gdpr: consentGranted ? 1 : 0,
      tcf: createSyntheticTcfString(consentGranted),
      us_privacy: '1YNN',
    },
    schain,
  };

  // Assemble ortb2.user.data from the enabled first-party data sources.
  type UserDataEntry = NonNullable<
    NonNullable<NonNullable<ImpExtPrebid['ortb2']>['user']>['data']
  >[number];

  const userData: UserDataEntry[] = [];

  if (includeAudience) {
    userData.push({
      id: 'permutive',
      name: 'permutive.com',
      provider: 'https://provider.permutive.com',
      // Seller-Defined Audience segment IDs (synthetic).
      segment: ['sda-9f2c', 'sda-44b1'],
    });
  }

  if (includeIdentity) {
    userData.push(
      { id: 'liveramp.com', segment: ['euid:1a2b3c4d'] },
      { id: 'prebid.org', segment: ['sharedid:9f8e7d6c'] },
    );
  }

  if (userData.length > 0 && extPrebid.ortb2) {
    extPrebid.ortb2.user = { data: userData };
  }

  const request: BidRequest = {
    id: requestId,
    imp: [
      {
        id: impressionId,
        tagid: 'atf_leaderboard',
        banner: {
          w: 300,
          h: 250,
          format: [
            [300, 250],
            [300, 600],
            [728, 90],
          ],
          topframe: 0,
        },
        ext: { prebid: extPrebid },
      },
    ],
    site: {
      id: 'site-nytimes',
      name: 'The New York Times',
      domain: 'nytimes.com',
      cat: ['IAB12'],
      page: 'https://www.nytimes.com/2026/04/12/technology/openrtb-explainer.html',
      publisher: { id: 'pub-nyt', domain: 'nytimes.com', name: 'The New York Times' },
    },
    tmax: timeoutMs,
    ext: {
      gpp: 'DBABMA~CPXxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF1XxF4AA',
      gpp_sid: ['8.CABaseConsentString'],
      ...(schain ? { schain } : {}),
    },
  };

  if (consentGranted) {
    request.user = {
      buyeruid: 'D3v1l3-St1cky-Us3r',
      ...(userData.length > 0 ? { data: userData } : {}),
      ext: { eids: ['5fa1f51b0aa7fa1feff40cc2.synthetic-euid'] },
    };
  }

  if (dealId) {
    request.pmp = {
      private_auction: 1,
      deals: [
        {
          id: dealId,
          bidfloor: floorPrice,
          bidfloorcur: 'USD',
          wseat: bidderCodes,
          at: 1,
        },
      ],
    };
  }

  return request;
}

export interface BuildBidOptions {
  bidId: string;
  impressionId: string;
  bidderCode: string;
  bidderName: string;
  cpm: number;
  latencyMs: number;
  dealId?: string;
  winning?: boolean;
}

/** Builds the OpenRTB 2.5 BidResponse an SSP returns for a single bidder. */
export function buildBidResponse(options: BuildBidOptions): BidResponse {
  const { bidId, impressionId, bidderCode, bidderName, cpm, dealId, winning } = options;

  return {
    id: bidId,
    seatbid: [
      {
        seat: bidderCode,
        bid: [
          {
            id: bidId,
            impid: impressionId,
            price: cpm,
            cur: 'USD',
            w: 300,
            h: 250,
            // Synthetic, watermarked creative. No real ad markup is produced.
            adm: `<div data-adtech-flow="synthetic" data-winner="${winning ? '1' : '0'}">${bidderName} — simulated 300x250 creative (educational simulation, not a real ad)</div>`,
            adomain: [bidderCode],
            cpid: `cpid-${bidderCode.toLowerCase()}`,
            cid: `cid-${bidderCode.toLowerCase()}`,
            ...(dealId ? { dealid: dealId } : {}),
            mtype: 1,
            ext: { measured: 'jscookieless', bidder: bidderCode },
          },
        ],
      },
    ],
    bidid: `${bidderCode}-${bidId}`,
    cur: 'USD',
    ext: { debug: 'adtech-flow-simulation', responseTimeMs: options.latencyMs },
  };
}

export type ValidationResult =
  | { valid: true; data: unknown }
  | { valid: false; errors: Array<{ path: string; message: string }> };

/** Validates a payload and flattens Zod issues into UI-friendly `{path, message}` pairs. */
export function validatePayload(schema: z.ZodTypeAny, payload: unknown): ValidationResult {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  };
}