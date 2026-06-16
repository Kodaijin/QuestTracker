'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  /** Animation duration in ms. */
  duration?: number;
  className?: string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates a number from its previous value up (or down) to `value` using
 * requestAnimationFrame. Snaps instantly when the user prefers reduced motion.
 */
export default function CountUp({ value, duration = 800, className }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = fromRef.current;
    const to = value;
    if (prefersReduced || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(from + (to - from) * easeOut(t)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
