/**
 * TimelineSlider.tsx — scrubbable 0ms → 300ms timeline (BACKLOG A-03).
 *
 * Accessibility: built on a native `input[type=range]`, so arrow keys, Home/End,
 * and screen-reader announcements all work for free. `aria-valuetext` announces
 * the human-readable phase rather than a bare millisecond count.
 */

import { AccessibleRange } from '@/components/ui/slider';
import { humanizePhase } from '@/lib/roleStyles';

export interface TimelineSliderProps {
  elapsedMs: number;
  durationMs: number;
  phase: string;
  phases: readonly string[];
  onScrub: (elapsedMs: number) => void;
}

export function TimelineSlider({
  elapsedMs,
  durationMs,
  phase,
  phases,
  onScrub,
}: TimelineSliderProps) {
  const currentIndex = phases.indexOf(phase);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-emerald-400">{elapsedMs.toFixed(0)}ms</span>
        <span className="font-medium text-slate-300">{humanizePhase(phase)}</span>
        <span className="font-mono text-slate-500">{durationMs}ms</span>
      </div>

      <AccessibleRange
        value={elapsedMs}
        min={0}
        max={durationMs}
        step={1}
        onValueChange={onScrub}
        aria-label="Auction timeline position in milliseconds"
        aria-valuetext={`${elapsedMs} milliseconds — ${humanizePhase(phase)}, phase ${currentIndex + 1} of ${phases.length}`}
        data-testid="timeline-slider"
      />

      {/* Phase ticks give a visual sense of where the boundaries sit. */}
      <ol className="flex flex-wrap gap-x-1.5 gap-y-1 text-[10px]" aria-label="Auction phases">
        {phases.map((p, index) => {
          const reached = index <= currentIndex;
          const isCurrent = p === phase;
          return (
            <li
              key={p}
              aria-current={isCurrent ? 'step' : undefined}
              className={
                isCurrent
                  ? 'font-semibold text-blue-400'
                  : reached
                    ? 'text-slate-400'
                    : 'text-slate-600'
              }
            >
              {humanizePhase(p)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}