/**
 * CategoryFilterBar.tsx — toggles node visibility by ecosystem category (BACKLOG M-05).
 *
 * Accessibility: each toggle is a real checkbox input with an associated label,
 * so it is reachable by Tab, toggled by Space, and announced correctly.
 */

import { CATEGORY_DESCRIPTIONS, CATEGORY_ORDER, roleStyle } from '@/lib/roleStyles';
import { cn } from '@/lib/utils';
import type { EcosystemNodeData } from '@/types';

export interface CategoryFilterBarProps {
  nodes: EcosystemNodeData[];
  visibleCategories: Record<string, boolean>;
  onToggle: (category: string) => void;
}

export function CategoryFilterBar({
  nodes,
  visibleCategories,
  onToggle,
}: CategoryFilterBarProps) {
  const countByCategory = useMemoCounts(nodes);

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filter ecosystem nodes by category"
    >
      {CATEGORY_ORDER.map((category) => {
        const style = roleStyle(category);
        const checked = visibleCategories[category] !== false;
        const count = countByCategory[category] ?? 0;

        return (
          <label
            key={category}
            title={CATEGORY_DESCRIPTIONS[category]}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
              checked
                ? cn(style.badge, 'border')
                : 'border-slate-700 bg-slate-900/40 text-slate-500 hover:text-slate-400',
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(category)}
              className="h-3 w-3 cursor-pointer rounded-sm border-slate-600 bg-slate-800 accent-current"
              data-testid={`category-filter-${category}`}
            />
            <span className={checked ? style.badge.split(' ')[1] : undefined}>{style.label}</span>
            <span className="font-mono text-[10px] opacity-70">{count}</span>
          </label>
        );
      })}
    </div>
  );
}

function useMemoCounts(nodes: EcosystemNodeData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    counts[node.category] = (counts[node.category] ?? 0) + 1;
  }
  return counts;
}