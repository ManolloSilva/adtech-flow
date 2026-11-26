import { useMemo, useState } from 'react';

import Editor from '@monaco-editor/react';

import {
  DEFAULT_BUYER_CODE,
  DEFAULT_SELLER_CODE,
  SANDBOX_PRESETS,
  runSandbox,
  type SandboxResult,
} from '@/lib/sandbox';
import { useAuctionStore } from '@/store/auctionStore';

export function DeveloperSandbox() {
  const config = useAuctionStore((s) => s.config);
  const [buyerCode, setBuyerCode] = useState(DEFAULT_BUYER_CODE);
  const [sellerCode, setSellerCode] = useState(DEFAULT_SELLER_CODE);
  const [presetId, setPresetId] = useState<string>('first-price');

  const result: SandboxResult = useMemo(
    () => runSandbox(buyerCode, sellerCode, config),
    [buyerCode, sellerCode, config],
  );

  const applyPreset = (id: string) => {
    const preset = SANDBOX_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setBuyerCode(preset.buyerCode);
    setSellerCode(preset.sellerCode);
    setPresetId(preset.id);
  };

  return (
    <div data-testid="sandbox" className="space-y-4">
      <div data-testid="developer-sandbox" className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sandbox preset templates">
        {SANDBOX_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-testid={`sandbox-preset-${preset.id}`}
            aria-pressed={presetId === preset.id}
            onClick={() => applyPreset(preset.id)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">buyer.js — generateBid()</h3>
          <div data-testid="buyer-editor" className="overflow-hidden rounded border border-slate-800">
            <Editor
              height="240px"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={buyerCode}
              onChange={(value) => setBuyerCode(value ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 12 }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">seller.js — scoreAd()</h3>
          <div data-testid="seller-editor" className="overflow-hidden rounded border border-slate-800">
            <Editor
              height="240px"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={sellerCode}
              onChange={(value) => setSellerCode(value ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 12 }}
            />
          </div>
        </div>
      </div>

      <div data-testid="sandbox-results" className="space-y-2">
        {result.error ? (
          <p data-testid="sandbox-error" className="text-sm text-red-400">
            {result.error}
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              {result.winningBid
                ? `Winner: ${result.winningBid.bidderName} at $${result.winningBid.cpm.toFixed(2)} CPM`
                : 'No eligible bids — adjust your scripts.'}
            </p>
            <ul className="space-y-1 text-xs">
              {result.bids.map((bid) => (
                <li key={bid.bidderId} data-testid={`sandbox-bid-${bid.bidderId}`} className="flex justify-between">
                  <span>{bid.bidderName}</span>
                  <span>
                    ${bid.cpm.toFixed(2)} · {bid.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
