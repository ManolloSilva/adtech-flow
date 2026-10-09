/**
 * PlaybackControls.tsx — Play / Pause / Step Next / Step Back / Reset (BACKLOG A-02).
 *
 * Every control is a real <button> with an aria-label and reflects its
 * disabled state correctly at the boundaries of the timeline.
 */

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { humanizePhase } from '@/lib/roleStyles';
import type { PlaybackStatus } from '@/types';

export interface PlaybackControlsProps {
  playback: PlaybackStatus;
  phase: string;
  stepNumber: number;
  totalSteps: number;
  canStepBack: boolean;
  canStepForward: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStepNext: () => void;
  onStepBack: () => void;
  onReset: () => void;
}

export function PlaybackControls({
  playback,
  phase,
  stepNumber,
  totalSteps,
  canStepBack,
  canStepForward,
  onPlay,
  onPause,
  onStepNext,
  onStepBack,
  onReset,
}: PlaybackControlsProps) {
  const isPlaying = playback === 'playing';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
          Step {stepNumber} of {totalSteps}
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
          {humanizePhase(phase)}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onStepBack}
          disabled={!canStepBack}
          aria-label="Step back to the previous auction phase"
          data-testid="step-back"
        >
          <SkipBack className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">Back</span>
        </Button>

        {isPlaying ? (
          <Button
            size="sm"
            onClick={onPause}
            aria-label="Pause the auction simulation"
            data-testid="pause"
            className="bg-amber-600 hover:bg-amber-500"
          >
            <Pause className="h-3.5 w-3.5" />
            <span>Pause</span>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onPlay}
            aria-label={playback === 'completed' ? 'Replay the auction simulation' : 'Play the auction simulation'}
            data-testid="play"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{playback === 'completed' ? 'Replay' : 'Play'}</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onStepNext}
          disabled={!canStepForward}
          aria-label="Step forward to the next auction phase"
          data-testid="step-next"
        >
          <span className="sr-only sm:not-sr-only">Next</span>
          <SkipForward className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onReset}
          aria-label="Reset the auction simulation to the beginning"
          data-testid="reset"
          className="col-span-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </Button>
      </div>
    </div>
  );
}