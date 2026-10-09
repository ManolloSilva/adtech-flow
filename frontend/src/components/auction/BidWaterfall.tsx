/**
 * BidWaterfall.tsx — per-bidder results with timeout / floor-rejection states (BACKLOG A-01, A-06).
 */

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { roleStyle } from '@/lib/roleStyles';
import { cn } from '@/lib/utils';
import type { BidderResult } from '@/types';

export interface BidWaterfallProps {
  bids: BidderResult[];
  activeBidders: string[];
  onToggleBidder: (bidderId: string) => void;
}

const STATUS_STYLES: Record<BidderResult['status'], { ring: string; badge: string; label: string }> = {
  submitted: {
    ring: 'border-slate-700 bg-slate-900/50',
    badge: 'bg-slate-700/60 text-slate-300 border-slate-600',
    label: 'Valid bid',
  },
  won: {
    ring: 'border-emerald-500/50 bg-emerald-500/10',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    label: 'Winner',
  },
  lost: {
    ring: 'border-slate-800 bg-slate-900/40',
    badge: 'bg-slate-700/50 text-slate-400 border-slate-700',
    label: 'Outbid',
  },
  timed_out: {
    ring: 'border-red-500/40 bg-red-500/5',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    label: 'Timed out',
  },
  below_floor: {
    ring: 'border-amber-500/40 bg-amber-500/5',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    label: 'Below floor',
  },
  no_bid: {
    ring: 'border-slate-800 bg-slate-950/40',
    badge: 'bg-slate-700/40 text-slate-500 border-slate-700',
    label: 'No bid',
  },
};

export function BidWaterfall({ bids, activeBidders, onToggleBidder }: BidWaterfallProps) {
  if (bids.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">
        All demand partners are disabled. Re-enable one to run the auction.
      </p>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Demand partner bids">
      {bids.map((bid) => {
        const style = STATUS_STYLES[bid.status];
        const isActive = activeBidders.includes(bid.bidderId);
        const sspStyle = roleStyle('ssp');

        return (
          <li
            key={bid.bidderId}
            className={cn('rounded-lg border p-2.5 transition-colors', style.ring)}
            data-testid={`bid-row-${bid.bidderId}`}
            data-status={bid.status}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={() => onToggleBidder(bid.bidderId)}
                  aria-label={`${isActive ? 'Remove' : 'Add'} ${bid.bidderName} ${isActive ? 'from' : 'to'} the auction`}
                  data-testid={`bidder-toggle-${bid.bidderId}`}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-slate-200">{bid.bidderName}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{bid.sspId.replace('node-ssp-', '')}</div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className={cn('font-mono text-sm font-semibold', bid.status === 'won' ? 'text-emerald-300' : 'text-slate-200')}>
                  ${bid.cpm.toFixed(2)}
                </div>
                <div className="font-mono text-[10px] text-slate-500">{bid.latencyMs}ms</div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', style.badge)}>
                {style.label}
              </span>
              {bid.dealId && (
                <Badge variant="outline" className="border-slate-700 bg-slate-800 font-mono text-[10px] text-slate-400">
                  PMP {bid.dealId}
                </Badge>
              )}
            </div>

            {bid.reason && (
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{bid.reason}</p>
            )}

            {/* Active-state bar uses the SSP colour so both halves of the hop read together. */}
            {!isActive && (
              <p className="mt-1.5 text-[10px] uppercase tracking-wider" style={{ color: sspStyle.hex }}>
                Excluded from auction
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}