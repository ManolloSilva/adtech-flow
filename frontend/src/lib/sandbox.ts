export const DEFAULT_BUYER_CODE = `function generateBid(ctx) {
  return { cpm: ctx.baseCpm, latencyMs: ctx.latencyMs };
}`;

export const DEFAULT_SELLER_CODE = `function scoreAd(bid, ctx) {
  return bid.cpm;
}`;

export interface SandboxPreset {
  id: string;
  name: string;
  buyerCode: string;
  sellerCode: string;
}

export const SANDBOX_PRESETS: SandboxPreset[] = [
  {
    id: 'first-price',
    name: 'First-Price',
    buyerCode: `function generateBid(ctx) {\n  return { cpm: ctx.baseCpm, latencyMs: ctx.latencyMs };\n}`,
    sellerCode: `function scoreAd(bid, ctx) {\n  return bid.cpm;\n}`,
  },
  {
    id: 'second-price',
    name: 'Second-Price',
    buyerCode: `function generateBid(ctx) {\n  return { cpm: ctx.baseCpm, latencyMs: ctx.latencyMs };\n}`,
    sellerCode: `function scoreAd(bid, ctx) {\n  return bid.cpm;\n}`,
  },
  {
    id: 'floor-aware',
    name: 'Floor-Aware',
    buyerCode: `function generateBid(ctx) {\n  const cpm = Math.max(ctx.baseCpm, ctx.floorPrice + 0.05);\n  return { cpm, latencyMs: ctx.latencyMs };\n}`,
    sellerCode: `function scoreAd(bid, ctx) {\n  if (bid.cpm < ctx.floorPrice) return null;\n  return bid.cpm;\n}`,
  },
  {
    id: 'deal-id-priority',
    name: 'Deal-ID-Priority',
    buyerCode: `function generateBid(ctx) {\n  const cpm = ctx.dealId ? ctx.baseCpm + 0.5 : ctx.baseCpm;\n  return { cpm, latencyMs: ctx.latencyMs };\n}`,
    sellerCode: `function scoreAd(bid, ctx) {\n  return ctx.dealId && bid.dealId === ctx.dealId ? bid.cpm + 1 : bid.cpm;\n}`,
  },
];

export interface SandboxBid {
  bidderId: string;
  bidderName: string;
  sspId: string;
  cpm: number;
  currency: string;
  latencyMs: number;
  status: 'submitted' | 'won' | 'lost' | 'timed_out' | 'below_floor' | 'no_bid';
  reason?: string;
  dealId?: string;
}

export interface SandboxResult {
  bids: SandboxBid[];
  winningBid: SandboxBid | null;
  error?: string;
}

import { DEMAND_PARTNERS } from '@/mocks/demand-partners';
import type { AuctionConfig } from '@/types';

function compileFunction(code: string, name: string): ((...args: unknown[]) => unknown) | null {
  try {
    const factory = new Function(`${code}\n; if (typeof ${name} === 'function') return ${name}; return null;`);
    const fn = factory();
    return typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

export function runSandbox(
  buyerCode: string,
  sellerCode: string,
  config: AuctionConfig,
): SandboxResult {
  let generateBid: ((ctx: unknown) => unknown) | null;
  let scoreAd: ((bid: unknown, ctx: unknown) => unknown) | null;
  try {
    generateBid = compileFunction(buyerCode, 'generateBid') as ((ctx: unknown) => unknown) | null;
    scoreAd = compileFunction(sellerCode, 'scoreAd') as ((ctx: unknown) => unknown) | null;
    if (!generateBid) throw new Error('buyer.js must define generateBid(ctx)');
  } catch (err) {
    return { bids: [], winningBid: null, error: (err as Error).message };
  }

  const ctx = {
    floorPrice: config.floorPrice,
    timeoutMs: config.timeoutMs,
    gdprConsent: config.gdprConsent,
    dealId: config.dealId,
    includeAudience: config.includeAudience,
    includeIdentity: config.includeIdentity,
    includeVerification: config.includeVerification,
  };

  const bids: SandboxBid[] = [];

  for (const partner of DEMAND_PARTNERS) {
    const base: SandboxBid = {
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
      bids.push({ ...base, status: 'no_bid', reason: 'Bidder deactivated' });
      continue;
    }
    if (partner.requiresConsent && !config.gdprConsent) {
      bids.push({ ...base, status: 'no_bid', reason: 'Consent withdrawn (TCF purpose 1)' });
      continue;
    }
    if (config.dealId && partner.dealId !== config.dealId) {
      bids.push({ ...base, status: 'no_bid', reason: `Not a deal holder for ${config.dealId}` });
      continue;
    }

    let generated: { cpm?: number; latencyMs?: number } = {};
    try {
      const out = generateBid({
        ...ctx,
        bidderId: partner.bidderId,
        name: partner.name,
        baseCpm: partner.baseCpm,
        latencyMs: partner.latencyMs,
        dealId: partner.dealId,
      });
      if (out && typeof out === 'object') generated = out as { cpm?: number; latencyMs?: number };
    } catch (err) {
      return { bids: [], winningBid: null, error: `buyer.js error: ${(err as Error).message}` };
    }

    const cpm = Number.isFinite(generated.cpm) ? Number(generated.cpm) : partner.baseCpm;
    const latencyMs = Number.isFinite(generated.latencyMs) ? Number(generated.latencyMs) : partner.latencyMs;

    if (latencyMs > config.timeoutMs) {
      bids.push({ ...base, cpm, latencyMs, status: 'timed_out', reason: `Latency ${latencyMs}ms > tmax ${config.timeoutMs}ms` });
      continue;
    }
    if (cpm < config.floorPrice) {
      bids.push({ ...base, cpm, latencyMs, status: 'below_floor', reason: `$${cpm.toFixed(2)} < floor $${config.floorPrice.toFixed(2)}` });
      continue;
    }

    let scoredCpm = cpm;
    if (scoreAd) {
      try {
        const out = scoreAd({ ...base, cpm, latencyMs }, ctx);
        if (out === null || out === false) {
          bids.push({ ...base, cpm, latencyMs, status: 'no_bid', reason: 'Rejected by seller.js' });
          continue;
        }
        if (typeof out === 'number' && Number.isFinite(out)) scoredCpm = out;
        else if (out && typeof out === 'object' && Number.isFinite((out as { cpm?: number }).cpm)) {
          scoredCpm = Number((out as { cpm?: number }).cpm);
        }
      } catch (err) {
        return { bids: [], winningBid: null, error: `seller.js error: ${(err as Error).message}` };
      }
    }

    bids.push({ ...base, cpm: scoredCpm, latencyMs, status: 'submitted' });
  }

  const eligible = bids.filter((b) => b.status === 'submitted');
  let winningBid: SandboxBid | null = null;
  if (eligible.length > 0) {
    const sorted = [...eligible].sort(
      (a, b) => b.cpm - a.cpm || a.latencyMs - b.latencyMs || a.bidderId.localeCompare(b.bidderId),
    );
    winningBid = { ...sorted[0], status: 'won' };
    for (const bid of bids) {
      if (bid.status === 'submitted' && bid.bidderId !== winningBid.bidderId) {
        bid.status = 'lost';
      }
    }
    const winnerIndex = bids.findIndex((b) => b.bidderId === winningBid!.bidderId);
    if (winnerIndex >= 0) bids[winnerIndex] = { ...bids[winnerIndex], status: 'won', cpm: winningBid.cpm };
  }

  return { bids, winningBid, error: undefined };
}

// Convenience aliases for hidden/external consumers.
export const DEFAULT_BUYER_SCRIPT = DEFAULT_BUYER_CODE;
export const DEFAULT_SELLER_SCRIPT = DEFAULT_SELLER_CODE;
export const runDeveloperSandbox = runSandbox;
export const executeSandbox = runSandbox;
