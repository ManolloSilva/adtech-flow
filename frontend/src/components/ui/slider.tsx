import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

/**
 * A labelled, accessible range input.
 *
 * Radix's `Slider` applies `aria-label` / `aria-valuetext` to the root element,
 * which is a plain `<span>` with no slider role — so screen readers announce
 * nothing and the value is not reachable. This wrapper instead renders a real
 * `<input type="range">`, which the browser exposes as `role="slider"`, wires to
 * the arrow / Home / End keys, and announces correctly.
 *
 * Use this for user-facing numeric controls. The underlying Radix slider remains
 * available for purely visual, non-interactive chrome.
 */
export interface AccessibleRangeProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  /** Announced instead of the raw number, e.g. "$2.50 dollars CPM". */
  'aria-valuetext': string;
}

const AccessibleRange = React.forwardRef<HTMLInputElement, AccessibleRangeProps>(
  ({ value, min, max, step = 1, onValueChange, className, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onValueChange(Number(event.target.value))}
      className={cn(
        'h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary',
        'accent-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      {...props}
    />
  ),
);
AccessibleRange.displayName = 'AccessibleRange';

export { AccessibleRange };