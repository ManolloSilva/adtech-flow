/**
 * CategoryStageCard.tsx — high-level category stage hub with embedded dropdown (M-06).
 *
 * Responsibilities:
 *  - Render a clean macro stage node on the React Flow canvas (Option 1).
 *  - Display the category role badge, role color styling, and total vendor count.
 *  - Provide an embedded, accessible dropdown menu (<select> / popover) to browse,
 *    switch, and inspect all member companies in this category from sellers.json.
 *  - Surface live auction bid statuses (Winner, Timed out, Below floor) for demand partners.
 *  - Prevent React Flow pan/drag during dropdown interactions via `nodrag nopan`.
 */

import { memo, useCallback, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, Info, Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { roleStyle } from '@/lib/roleStyles';
import { cn } from '@/lib/utils';
import type { BidderResult, EcosystemNodeData, EntityCategory } from '@/types';

export interface CategoryStageCardData {
  category: EntityCategory;
  vendors: EcosystemNodeData[];
  activeVendorId: string;
  isActive: boolean;
  isSelected: boolean;
  bids: BidderResult[];
  winningBid: BidderResult | null;
  onSelectVendor: (category: EntityCategory, vendorId: string) => void;
  onInspectVendor: (vendorId: string) => void;
}

const CATEGORY_TITLES: Record<EntityCategory, string> = {
  publisher: 'Publishers',
  cmp: 'Consent (CMP)',
  audience: 'Audience / DMP',
  identity: 'Identity / CDP',
  ssp: 'SSPs (Supply)',
  dsp: 'DSPs (Demand)',
  adserver: 'Ad Server',
  verification: 'Verification (IAS)',
};

const STATUS_TONE_CLASSES: Record<string, string> = {
  won: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  timed_out: 'bg-red-500/20 text-red-300 border-red-500/40',
  below_floor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  no_bid: 'bg-slate-700/50 text-slate-300 border-slate-600',
  submitted: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
};

const STATUS_LABELS: Record<string, string> = {
  won: 'Winner',
  timed_out: 'Timed out',
  below_floor: 'Below floor',
  no_bid: 'No bid',
  submitted: 'Bid submitted',
};

type CategoryStageCardProps = NodeProps & { data: CategoryStageCardData };

function CategoryStageCardComponent({ data }: CategoryStageCardProps) {
  const {
    category,
    vendors,
    activeVendorId,
    isActive,
    isSelected,
    bids,
    winningBid,
    onSelectVendor,
    onInspectVendor,
  } = data;

  const [isOpen, setIsOpen] = useState(false);
  const style = roleStyle(category);

  const activeVendor = vendors.find((v) => v.id === activeVendorId) ?? vendors[0];

  // Derive bid status for active vendor (if DSP)
  const activeBid = bids.find((b) => b.bidderId === activeVendor?.id);
  const isWinningStage = winningBid && (
    (category === 'dsp' && winningBid.bidderId === activeVendor?.id) ||
    (category === 'ssp' && winningBid.sspId === activeVendor?.id)
  );

  const handleToggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  const handleSelect = useCallback(
    (vendorId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectVendor(category, vendorId);
      setIsOpen(false);
    },
    [category, onSelectVendor],
  );

  const handleInspectActive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (activeVendor) {
        onInspectVendor(activeVendor.id);
      }
    },
    [activeVendor, onInspectVendor],
  );

  const handleInspectSpecific = useCallback(
    (vendorId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onInspectVendor(vendorId);
    },
    [onInspectVendor],
  );

  return (
    <div
      className={cn(
        'relative w-[230px] rounded-xl border bg-slate-900/95 p-3 shadow-lg backdrop-blur transition-all',
        style.node,
        isSelected && 'ring-2 ring-ring',
        !isActive && 'opacity-40 grayscale',
      )}
      data-testid={`category-stage-card-${category}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-0 !bg-slate-500"
      />

      {/* Header: Role badge & count */}
      <div className="flex items-center justify-between gap-1.5 pb-2">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Badge
            variant="outline"
            className={cn('px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider', style.badge)}
          >
            {style.label}
          </Badge>
          <span className="truncate text-xs font-semibold text-foreground">
            {CATEGORY_TITLES[category] ?? style.label}
          </span>
        </div>

        <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          {vendors.length}
        </span>
      </div>

      {/* Embedded Dropdown Trigger (nodrag nopan) */}
      <div className="nodrag nopan relative mt-1">
        <button
          type="button"
          onClick={handleToggleOpen}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`${style.label} vendor selector. Currently ${activeVendor?.name ?? 'none'}`}
          data-testid={`category-stage-dropdown-${category}`}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700/80 bg-slate-950/80 px-2.5 py-2 text-left transition-colors',
            'hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-200">
              {activeVendor?.name ?? 'Select entity...'}
            </div>
            <div className="truncate font-mono text-[10px] text-slate-400">
              {activeVendor?.domain ?? ''}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isWinningStage && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Winning bid" />
            )}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </div>
        </button>

        {/* Dropdown Menu Popover with backdrop overlay */}
        {isOpen && (
          <>
            <div
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => setIsOpen(false)}
              className="nodrag nopan fixed inset-0 z-40 cursor-default"
            />
            <div
              role="listbox"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              aria-label={`${style.label} vendor list`}
              className="nodrag nopan absolute left-0 top-full z-50 mt-1 max-h-56 w-[260px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/98 p-1.5 shadow-2xl backdrop-blur"
            >
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {style.label} Vendors ({vendors.length})
            </div>

            <div className="space-y-0.5">
              {vendors.map((vendor) => {
                const isCurrent = vendor.id === activeVendor?.id;
                const vendorBid = bids.find((b) => b.bidderId === vendor.id);
                const statusTone = vendorBid?.status ? STATUS_TONE_CLASSES[vendorBid.status] : null;
                const statusText = vendorBid?.status ? STATUS_LABELS[vendorBid.status] : null;

                return (
                  <div
                    key={vendor.id}
                    role="option"
                    aria-selected={isCurrent}
                    data-testid={`category-stage-option-${vendor.id}`}
                    onClick={(e) => handleSelect(vendor.id, e)}
                    className={cn(
                      'group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs cursor-pointer transition-colors',
                      isCurrent
                        ? 'bg-slate-800/90 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="w-3.5 shrink-0 text-blue-400">
                        {isCurrent && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{vendor.name}</div>
                        <div className="truncate font-mono text-[10px] text-slate-400">
                          {vendor.domain}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {statusText && statusTone && (
                        <span
                          className={cn(
                            'rounded border px-1 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-tight',
                            statusTone,
                          )}
                        >
                          {statusText}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleInspectSpecific(vendor.id, e)}
                        title={`Inspect ${vendor.name} sellers.json details`}
                        aria-label={`Inspect ${vendor.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>

      {/* Card Footer: Live status & Inspect quick action */}
      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px]">
        {activeBid && activeBid.status !== 'no_bid' ? (
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-tight',
              STATUS_TONE_CLASSES[activeBid.status] ?? 'text-slate-400 border-slate-700',
            )}
          >
            {STATUS_LABELS[activeBid.status] ?? activeBid.status}
            {activeBid.cpm > 0 ? ` · $${activeBid.cpm.toFixed(2)}` : ''}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-slate-400">
            {activeVendor?.sellerType ?? 'INTERMEDIARY'}
          </span>
        )}

        <button
          type="button"
          onClick={handleInspectActive}
          className="nodrag nopan flex items-center gap-1 font-medium text-slate-400 hover:text-blue-400 transition-colors"
          title={`Inspect ${activeVendor?.name ?? style.label} details`}
        >
          <span>Details</span>
          <Info className="h-3 w-3" />
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-0 !bg-slate-500"
      />
    </div>
  );
}

export const CategoryStageCard = memo(CategoryStageCardComponent);
