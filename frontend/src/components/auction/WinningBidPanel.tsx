/**
 * WinningBidPanel.tsx — winner badge, CPM value, bidder name (BACKLOG A-05).
 */

import { Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { BidderResult } from '@/types';

export interface WinningBidPanelProps {
  winningBid: BidderResult | null;
  /** Rendered even before arbitration, so the panel does not pop in abruptly. */
  phase: string;
  totalBids: number;
  eligibleBids: number;
}

export function WinningBidPanel({
  winningBid,
  phase,
  totalBids,
  eligibleBids,
}: WinningBidPanelProps) {
  const arbitrated = phase === 'GAM_ARBITRATION' || phase === 'AD_RENDERED' || phase === 'VERIFICATION_MEASURED';

  if (!arbitrated) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-3 text-xs text-slate-500">
        The winning bid is decided at <strong className="text-slate-400">GAM Arbitration</strong>. Step
        forward or play the simulation to see the result.
      </div>
    );
  }

  if (!winningBid) {
    return (
      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200"
        data-testid="winning-bid-none"
      >
        <div className="font-semibold">No bid cleared the auction</div>
        <p className="mt-1 text-amber-200/80">
          All {totalBids} demand partners were rejected — try lowering the floor price or increasing the
          timeout.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
      data-testid="winning-bid-panel"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span className="text-sm font-semibold text-emerald-300">Auction Winner</span>
        </div>
        <Badge className="border border-emerald-500/40 bg-emerald-500/20 font-mono text-emerald-200">
          ${winningBid.cpm.toFixed(2)} CPM
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-slate-500">Bidder</dt>
          <dd className="mt-0.5 truncate font-medium text-slate-200">{winningBid.bidderName}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-slate-500">Latency</dt>
          <dd className="mt-0.5 font-mono text-slate-200">{winningBid.latencyMs}ms</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-slate-500">Eligible</dt>
          <dd className="mt-0.5 font-mono text-slate-200">
            {eligibleBids}/{totalBids}
          </dd>
        </div>
      </dl>

      <Separator className="my-2.5" />

      <p className="text-[11px] leading-relaxed text-slate-400">
        Google Ad Manager evaluated this header bidding bid against its direct line items. The bid was
        passed via the <code className="font-mono text-slate-300">hb_pb</code> key-value.
      </p>
    </div>
  );
}