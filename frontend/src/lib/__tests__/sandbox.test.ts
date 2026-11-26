import { describe, it, expect } from 'vitest';
import { runSandbox, DEFAULT_BUYER_CODE, DEFAULT_SELLER_CODE, SANDBOX_PRESETS } from '@/lib/sandbox';
import { DEFAULT_CONFIG } from '@/store/auctionStore';

describe('sandbox', () => {
  it('runs default', () => {
    const r = runSandbox(DEFAULT_BUYER_CODE, DEFAULT_SELLER_CODE, DEFAULT_CONFIG);
    expect(r.error).toBeUndefined();
    expect(r.winningBid).not.toBeNull();
  });
  it('presets run', () => {
    for (const p of SANDBOX_PRESETS) {
      const r = runSandbox(p.buyerCode, p.sellerCode, DEFAULT_CONFIG);
      expect(r.error).toBeUndefined();
    }
  });
  it('catches bad code', () => {
    const r = runSandbox('function generateBid(){ throw new Error("boom"); }', DEFAULT_SELLER_CODE, DEFAULT_CONFIG);
    expect(r.error).toContain('buyer.js error');
  });
});
