'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    const clampedValue = Math.min(Math.max(value || 0, 0), 100);

    // Start at 0 on mount, then animate to the real width via the CSS transition.
    // Snap straight to the value when the user prefers reduced motion.
    const [displayValue, setDisplayValue] = React.useState(0);
    React.useEffect(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        setDisplayValue(clampedValue);
        return;
      }
      const id = requestAnimationFrame(() => setDisplayValue(clampedValue));
      return () => cancelAnimationFrame(id);
    }, [clampedValue]);

    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-zinc-800', className)}
        {...props}
      >
        <div
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-700 ease-out"
          style={{ width: `${displayValue}%` }}
        >
          {clampedValue > 0 && (
            <span
              className="progress-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              aria-hidden
            />
          )}
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };
