'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

const BURST_CHARS = ['✦', '✧', '✶', '⋆'];
const RISE_CHARS = ['✦', '✧', '✨', '⭐', '🌟', '⋆'];

/** An equipped celebration-particle cosmetic (chars + Tailwind text color). */
export type ParticleStyle = { chars: string[]; colorClass: string };
const DEFAULT_RISE: ParticleStyle = { chars: RISE_CHARS, colorClass: 'text-amber-300' };

type BurstParticle = { dx: number; dy: number; delay: number; char: string };
type RiseParticle = { left: number; delay: number; size: number; char: string };

/**
 * A short-lived burst of sparkles flying outward from its center. Mount it
 * (keyed by a nonce so it remounts each trigger) over the element you want to
 * celebrate; it auto-fades via CSS. The parent must be `position: relative`.
 */
export function SparkleBurst({ count = 8 }: { count?: number }) {
  const [particles] = useState<BurstParticle[]>(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 16 + Math.random() * 12;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: Math.random() * 0.08,
        char: BURST_CHARS[i % BURST_CHARS.length],
      };
    }),
  );

  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="sparkle-burst-particle text-[0.7rem] leading-none text-amber-300"
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        >
          {p.char}
        </span>
      ))}
    </span>
  );
}

/**
 * The "quest complete" celebration: sparkles drifting upward across the header
 * plus a floating toast. Render inside a `position: relative` container (the
 * toast is fixed, so it escapes to the viewport regardless).
 */
export function QuestCompleteEffect({
  count = 18,
  particle = DEFAULT_RISE,
}: {
  count?: number;
  particle?: ParticleStyle;
}) {
  const [particles] = useState<RiseParticle[]>(() =>
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.7,
      size: 0.7 + Math.random() * 0.8,
      char: particle.chars[Math.floor(Math.random() * particle.chars.length)],
    })),
  );

  return (
    <>
      {/* Rising sparkles layered over the header. */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 top-0 overflow-visible"
        aria-hidden
      >
        {particles.map((p, i) => (
          <span
            key={i}
            className={`sparkle-rise-particle leading-none ${particle.colorClass}`}
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}rem`,
              animationDelay: `${p.delay}s`,
            }}
          >
            {p.char}
          </span>
        ))}
      </span>

      {/* Floating toast. */}
      <div
        role="status"
        className="animate-toast fixed left-1/2 top-6 z-50 flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-950/80 px-5 py-2 text-sm font-semibold text-amber-200 shadow-glow backdrop-blur"
      >
        <span aria-hidden>✨</span>
        Quest Complete!
        <span aria-hidden>✨</span>
      </div>
    </>
  );
}

/**
 * The "level up" celebration: a brighter shower of rising sparkles plus a
 * prominent toast announcing the new level and rank title. Mount it keyed by a
 * nonce so it remounts (and re-animates) on each level gain; it auto-fades.
 */
export function LevelUpEffect({
  level,
  title,
  particle = DEFAULT_RISE,
}: {
  level: number;
  title: string;
  particle?: ParticleStyle;
}) {
  const [particles] = useState<RiseParticle[]>(() =>
    Array.from({ length: 28 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      size: 0.8 + Math.random() * 1.1,
      char: particle.chars[Math.floor(Math.random() * particle.chars.length)],
    })),
  );

  return (
    <>
      {/* Full-viewport sparkle shower. */}
      <span className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {particles.map((p, i) => (
          <span
            key={i}
            className={`sparkle-rise-particle leading-none ${particle.colorClass}`}
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}rem`,
              animationDelay: `${p.delay}s`,
            }}
          >
            {p.char}
          </span>
        ))}
      </span>

      {/* Level-up toast. */}
      <div
        role="status"
        className="animate-toast fixed left-1/2 top-6 z-50 flex flex-col items-center gap-0.5 rounded-2xl border border-amber-400/60 bg-amber-950/85 px-7 py-3 text-center shadow-glow backdrop-blur"
      >
        <span className="text-base font-bold text-amber-200">⬆ Level {level}!</span>
        <span className="text-xs font-medium text-amber-300/90">You are now a {title}</span>
      </div>
    </>
  );
}

/**
 * The companion "evolution" celebration: an emerald sparkle shower plus a toast
 * announcing the new stage. Mount keyed by a nonce so it remounts on each
 * evolution; it auto-fades. Modeled on LevelUpEffect.
 */
export function PetEvolveEffect({ emoji, stageLabel }: { emoji: string; stageLabel: string }) {
  const [particles] = useState<RiseParticle[]>(() =>
    Array.from({ length: 24 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      size: 0.8 + Math.random() * 1.0,
      char: RISE_CHARS[Math.floor(Math.random() * RISE_CHARS.length)],
    })),
  );

  return (
    <>
      <span className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {particles.map((p, i) => (
          <span
            key={i}
            className="sparkle-rise-particle leading-none text-emerald-300"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}rem`,
              animationDelay: `${p.delay}s`,
            }}
          >
            {p.char}
          </span>
        ))}
      </span>

      <div
        role="status"
        className="animate-toast fixed left-1/2 top-6 z-50 flex flex-col items-center gap-0.5 rounded-2xl border border-emerald-400/60 bg-emerald-950/85 px-7 py-3 text-center shadow-glow backdrop-blur"
      >
        <span className="text-2xl leading-none" aria-hidden>{emoji}</span>
        <span className="text-base font-bold text-emerald-200">Your companion evolved!</span>
        <span className="text-xs font-medium text-emerald-300/90">Now a {stageLabel}</span>
      </div>
    </>
  );
}
