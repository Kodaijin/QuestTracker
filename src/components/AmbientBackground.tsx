import type { CSSProperties } from 'react';

/**
 * Full-screen ambient motion layer rendered once behind all page content.
 * Pure CSS (no client JS): drifting aurora glow blobs + rising light motes.
 * Sits at `-z-10` over the dark backdrop on <html>; honors reduced motion via
 * the rules in globals.css.
 */

type Blob = {
  color: string;
  size: string;
  top: string;
  left: string;
  dur: string;
  delay: string;
  tx: string;
  ty: string;
};

const BLOBS: Blob[] = [
  { color: 'rgba(99,102,241,0.40)', size: '42rem', top: '-12%', left: '-8%', dur: '17s', delay: '0s', tx: '8%', ty: '6%' },
  { color: 'rgba(139,92,246,0.34)', size: '38rem', top: '20%', left: '58%', dur: '21s', delay: '-4s', tx: '-7%', ty: '8%' },
  { color: 'rgba(217,70,239,0.22)', size: '30rem', top: '55%', left: '8%', dur: '19s', delay: '-9s', tx: '10%', ty: '-6%' },
  { color: 'rgba(245,158,11,0.20)', size: '32rem', top: '62%', left: '62%', dur: '23s', delay: '-2s', tx: '-9%', ty: '-9%' },
];

// Deterministic motes so the server-rendered markup matches the client (no
// hydration mismatch). Hand-spread across the width at varied speeds/sizes.
const MOTES = [
  { left: 4, size: 5, dur: 15, delay: 0, dx: '2rem' },
  { left: 11, size: 3, dur: 19, delay: 6, dx: '-1.5rem' },
  { left: 17, size: 6, dur: 13, delay: 2, dx: '1rem' },
  { left: 23, size: 2, dur: 22, delay: 9, dx: '2.5rem' },
  { left: 29, size: 4, dur: 16, delay: 4, dx: '-2rem' },
  { left: 34, size: 3, dur: 20, delay: 11, dx: '1.5rem' },
  { left: 40, size: 5, dur: 14, delay: 1, dx: '-1rem' },
  { left: 45, size: 2, dur: 24, delay: 7, dx: '2rem' },
  { left: 51, size: 6, dur: 12, delay: 3, dx: '-2.5rem' },
  { left: 56, size: 3, dur: 18, delay: 10, dx: '1rem' },
  { left: 62, size: 4, dur: 15, delay: 5, dx: '-1.5rem' },
  { left: 67, size: 2, dur: 23, delay: 13, dx: '2rem' },
  { left: 72, size: 5, dur: 13, delay: 2, dx: '-1rem' },
  { left: 77, size: 3, dur: 21, delay: 8, dx: '1.5rem' },
  { left: 82, size: 6, dur: 14, delay: 4, dx: '-2rem' },
  { left: 87, size: 2, dur: 25, delay: 12, dx: '1rem' },
  { left: 92, size: 4, dur: 16, delay: 6, dx: '-1.5rem' },
  { left: 96, size: 3, dur: 19, delay: 1, dx: '2rem' },
  { left: 8, size: 3, dur: 17, delay: 14, dx: '-1rem' },
  { left: 20, size: 4, dur: 20, delay: 3, dx: '1rem' },
  { left: 37, size: 2, dur: 26, delay: 9, dx: '-2rem' },
  { left: 48, size: 5, dur: 15, delay: 5, dx: '1.5rem' },
  { left: 60, size: 3, dur: 22, delay: 11, dx: '-1rem' },
  { left: 70, size: 4, dur: 18, delay: 0, dx: '2rem' },
  { left: 84, size: 2, dur: 24, delay: 7, dx: '-1.5rem' },
  { left: 90, size: 5, dur: 13, delay: 10, dx: '1rem' },
  { left: 14, size: 2, dur: 27, delay: 4, dx: '-2rem' },
  { left: 53, size: 4, dur: 16, delay: 8, dx: '1rem' },
];

export default function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {BLOBS.map((b, i) => (
        <div
          key={`blob-${i}`}
          className="aurora-blob"
          style={
            {
              background: `radial-gradient(circle, ${b.color}, transparent 70%)`,
              width: b.size,
              height: b.size,
              top: b.top,
              left: b.left,
              '--dur': b.dur,
              '--delay': b.delay,
              '--tx': b.tx,
              '--ty': b.ty,
            } as CSSProperties
          }
        />
      ))}

      {MOTES.map((m, i) => (
        <span
          key={`mote-${i}`}
          className="mote"
          style={
            {
              left: `${m.left}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              '--dur': `${m.dur}s`,
              '--delay': `${m.delay}s`,
              '--dx': m.dx,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
