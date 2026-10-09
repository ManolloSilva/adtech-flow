/**
 * NodeDetailSheet.tsx — slide-out inspector for a selected ecosystem node (BACKLOG M-04).
 *
 * Shows the entity's role, seller type (PUBLISHER / INTERMEDIARY), domain, and
 * known integrations. All company references are plain typography badges per the
 * Nominative Fair Use constraint in product-spec.md §7.
 */

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CATEGORY_DESCRIPTIONS, roleStyle } from '@/lib/roleStyles';
import type { EcosystemNodeData } from '@/types';

export interface NodeDetailSheetProps {
  node: EcosystemNodeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bidder results, used to show this entity's role in the current auction. */
  bid?: { cpm: number; status: string; latencyMs: number; reason?: string };
}

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Bid submitted', className: 'bg-slate-700/50 text-slate-300 border-slate-600' },
  won: { label: 'Auction winner', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  lost: { label: 'Bid lost', className: 'bg-slate-700/50 text-slate-400 border-slate-600' },
  timed_out: { label: 'Timed out', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
  below_floor: { label: 'Below floor', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  no_bid: { label: 'Did not bid', className: 'bg-slate-700/50 text-slate-400 border-slate-600' },
};

export function NodeDetailSheet({ node, open, onOpenChange, bid }: NodeDetailSheetProps) {
  if (!node) return null;

  const style = roleStyle(node.category);
  const status = bid ? STATUS_COPY[bid.status] : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${style.badge}`}>
              {style.label}
            </Badge>
            {node.isOptional && (
              <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-400">
                Optional vendor
              </Badge>
            )}
          </div>
          <SheetTitle>{node.name}</SheetTitle>
          <SheetDescription>{CATEGORY_DESCRIPTIONS[node.category]}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <section aria-label="Role in the auction">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Role in the auction
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{node.description}</p>
          </section>

          <Separator />

          <section aria-label="Seller declaration" className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Seller type
              </dt>
              <dd className="mt-1">
                <Badge variant="outline" className="border-slate-700 bg-slate-800 font-mono text-slate-300">
                  {node.sellerType}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Domain
              </dt>
              <dd className="mt-1 truncate font-mono text-sm text-slate-200">{node.domain}</dd>
            </div>
            {node.sourceSsp && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Discovered via
                </dt>
                <dd className="mt-1 text-sm text-slate-300">{node.sourceSsp} sellers.json</dd>
              </div>
            )}
          </section>

          {bid && (
            <>
              <Separator />
              <section aria-label="Current auction activity">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Current auction activity
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  {status && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  )}
                  <span className="font-mono text-sm text-slate-200">${bid.cpm.toFixed(2)} CPM</span>
                  <span className="text-xs text-slate-500">{bid.latencyMs}ms</span>
                </div>
                {bid.reason && (
                  <p className="mt-2 text-xs text-slate-400">{bid.reason}</p>
                )}
              </section>
            </>
          )}

          <Separator />

          <section aria-label="Known integrations">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Known integrations
            </h3>
            <ul className="mt-2 space-y-1.5">
              {INTEGRATIONS[node.category]?.map((integration) => (
                <li key={integration} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" aria-hidden="true" />
                  {integration}
                </li>
              )) ?? (
                <li className="text-sm text-slate-500">No documented integrations in this simulation.</li>
              )}
            </ul>
          </section>

          <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
            Referenced for nominative, educational, and descriptive purposes only. All trademarks
            are the property of their respective owners; no affiliation or endorsement is implied.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Documented relationships per category, used by the inspector panel. */
const INTEGRATIONS: Record<string, string[]> = {
  publisher: ['Prebid.js header bidding wrapper', 'Consent Management Platform', 'Ad server tag (GAM key-values)'],
  cmp: ['IAB TCF v2.2 consent string', 'Google Consent Mode v2', 'Vendor list scanning per purpose'],
  adserver: ['Key-value bidding (hb_pb)', 'Direct line item priority', 'Programmatic demand fallback'],
  ssp: ['OpenRTB 2.5 / 3.0 endpoints', 'Price floor enforcement', 'PMP deal precedence', 'Supply-path (schain) validation'],
  dsp: ['OpenRTB bid response', 'First-party ID modules (RampID, SharedID)', 'Deal-ID targeting'],
  identity: ['Envelope ID sync', 'Frequency capping', 'Audience matching'],
  audience: ['Seller-Defined Audience segments', 'On-device cohort evaluation', 'ortb2.user.data injection'],
  verification: ['Viewability measurement (MRC/OMID)', 'Brand safety classification', 'Invalid traffic (IVT) estimation'],
};