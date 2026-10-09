/**
 * EcosystemNodeCard.tsx — the custom React Flow node (BACKLOG M-02 / M-03).
 *
 * Accessibility (docs/design-system.md §4, WCAG 2.1 AA):
 *  - The card is a real `<button>`, so it is Tab-reachable and fires on Enter/Space.
 *  - `role="button"` + `aria-label` describe the entity, its role, and its state.
 *  - `aria-pressed` reflects selection.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import { Badge } from '@/components/ui/badge';
import { roleStyle } from '@/lib/roleStyles';
import { cn } from '@/lib/utils';
import type { EcosystemNodeData } from '@/types';

export interface EcosystemNodeCardData extends EcosystemNodeData {
  /** False when an optional vendor is toggled off, or filtered out. */
  isActive: boolean;
  isSelected: boolean;
  /** Optional one-word state overlay, e.g. "TIMED OUT" or "BELOW FLOOR". */
  statusLabel?: string;
  statusTone?: 'win' | 'danger' | 'warning' | 'neutral';
}

const STATUS_TONE_CLASSES: Record<NonNullable<EcosystemNodeCardData['statusTone']>, string> = {
  win: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  danger: 'bg-red-500/20 text-red-300 border-red-500/40',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  neutral: 'bg-slate-700/50 text-slate-300 border-slate-600',
};

/**
 * React Flow's `NodeProps` generic parameter describes the *node record*, not
 * the shape of `data`. The record's `data` field is what carries our payload.
 */
type EcosystemNodeCardProps = NodeProps & { data: EcosystemNodeCardData };

function EcosystemNodeCardComponent({ data }: EcosystemNodeCardProps) {
  const { name, category, domain, isActive, isSelected, statusLabel, statusTone } = data;
  const style = roleStyle(category);
  const tone = statusTone ?? 'neutral';

  const ariaLabel = [
    name,
    style.label,
    `domain ${domain}`,
    isActive ? 'included in auction' : 'excluded from auction',
    statusLabel ? `status ${statusLabel}` : null,
    isSelected ? 'selected' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className="relative"
      style={{ opacity: isActive ? 1 : 0.4 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-slate-600"
      />

      <button
        type="button"
        role="button"
        aria-label={ariaLabel}
        aria-pressed={isSelected}
        data-selected={isSelected || undefined}
        data-inactive={!isActive || undefined}
        data-testid={`ecosystem-node-${data.id}`}
        className={cn(
          'w-[200px] rounded-xl border bg-card p-3 text-left transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          style.node,
          isSelected && 'ring-2 ring-ring',
          !isActive && 'grayscale',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', style.badge)}>
            {style.label}
          </Badge>
          {statusLabel && (
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-tight',
                STATUS_TONE_CLASSES[tone],
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>

        <div className="mt-2 truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">{domain}</div>
      </button>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-slate-600"
      />
    </div>
  );
}

export const EcosystemNodeCard = memo(EcosystemNodeCardComponent);