/**
 * AuctionConfigPanel.tsx — floor price and timeout sliders.
 *
 * These land in the Alpha slice because the demo auction already models both
 * rules; the richer configurability (PMP deal toggle, per-bidder latency) is
 * Beta scope but the store already carries the fields.
 */

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AccessibleRange } from '@/components/ui/slider';
import type { AuctionConfig } from '@/types';

export interface AuctionConfigPanelProps {
  config: AuctionConfig;
  onChange: (patch: Partial<AuctionConfig>) => void;
}

export function AuctionConfigPanel({ config, onChange }: AuctionConfigPanelProps) {
  return (
    <section aria-label="Auction parameters" className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Auction parameters
      </h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="floor-slider" className="text-xs text-slate-400">
            Publisher floor
          </Label>
          <span className="font-mono text-xs font-semibold text-emerald-400" data-testid="floor-value">
            ${config.floorPrice.toFixed(2)} CPM
          </span>
        </div>
        <AccessibleRange
          id="floor-slider"
          value={config.floorPrice}
          min={0}
          max={10}
          step={0.25}
          onValueChange={(value) => onChange({ floorPrice: value })}
          aria-label="Publisher floor price in USD CPM"
          aria-valuetext={`${config.floorPrice.toFixed(2)} dollars CPM`}
          data-testid="floor-slider"
        />
        <p className="text-[11px] text-slate-500">
          Bids below the floor are discarded before arbitration.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="timeout-slider" className="text-xs text-slate-400">
            Auction timeout (tmax)
          </Label>
          <span className="font-mono text-xs font-semibold text-blue-400" data-testid="timeout-value">
            {config.timeoutMs}ms
          </span>
        </div>
        <AccessibleRange
          id="timeout-slider"
          value={config.timeoutMs}
          min={50}
          max={3000}
          step={25}
          onValueChange={(value) => onChange({ timeoutMs: value })}
          aria-label="Auction timeout in milliseconds"
          aria-valuetext={`${config.timeoutMs} milliseconds`}
          data-testid="timeout-slider"
        />
        <p className="text-[11px] text-slate-500">
          Bids arriving after tmax are discarded regardless of price.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="pmp-toggle" className="text-xs text-slate-400">
            PMP Deal ID
          </Label>
          <Switch
            id="pmp-toggle"
            checked={!!config.dealId}
            onCheckedChange={(value) => onChange({ dealId: value ? 'DEAL-001' : undefined })}
            aria-label={config.dealId ? 'Disable PMP deal' : 'Enable PMP deal'}
            data-testid="pmp-toggle"
          />
        </div>
        {config.dealId && (
          <input
            type="text"
            value={config.dealId}
            onChange={(e) => onChange({ dealId: e.target.value || undefined })}
            aria-label="PMP Deal ID value"
            data-testid="deal-id-input"
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
          />
        )}
        <p className="text-[11px] text-slate-500">
          Restricts the auction to deal holders only.
        </p>
      </div>
    </section>
  );
}