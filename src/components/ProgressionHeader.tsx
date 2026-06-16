'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getProgression, type Progression } from '@/app/actions/progression';
import { dayKey } from '@/lib/progression';
import { LevelUpEffect } from '@/components/QuestEffects';
import CountUp from '@/components/CountUp';

interface Props {
  /** Server-fetched progression for instant first paint (optional). */
  initial?: Progression;
  /** Bump this number to force a re-fetch (e.g. after a toggle awards XP). */
  refreshSignal?: number;
}

/**
 * Compact level + XP bar + streak flame. Re-fetches progression whenever
 * `refreshSignal` changes and fires a LevelUpEffect when the level increases.
 * Links to the Hero profile. Self-contained so it can be dropped on any page.
 */
export default function ProgressionHeader({ initial, refreshSignal = 0 }: Props) {
  const [prog, setProg] = useState<Progression | null>(initial ?? null);
  const [levelUpNonce, setLevelUpNonce] = useState(0);
  const prevLevel = useRef<number | null>(initial ? initial.level : null);

  useEffect(() => {
    let cancelled = false;
    getProgression()
      .then((next) => {
        if (cancelled) return;
        if (prevLevel.current != null && next.level > prevLevel.current) {
          setLevelUpNonce((n) => n + 1);
        }
        prevLevel.current = next.level;
        setProg(next);
      })
      .catch(() => {
        /* unauthenticated or transient — header just stays as-is */
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  if (!prog) return null;

  const pct =
    prog.xpForNextLevel > 0
      ? Math.min(100, Math.round((prog.xpIntoLevel / prog.xpForNextLevel) * 100))
      : 100;

  const today = dayKey(new Date());
  const streakActiveToday = prog.streak.lastActiveDay === today;
  const streakAtRisk = prog.streak.current > 0 && !streakActiveToday;

  return (
    <>
      <Link
        href="/hero"
        className="group flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 transition-colors hover:border-amber-500/40"
        aria-label="View your hero profile"
      >
        {/* Level badge */}
        <div className="flex flex-col items-center justify-center rounded-lg bg-amber-950/40 border border-amber-500/40 px-3 py-1.5 min-w-[3.25rem]">
          <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-amber-400/80">
            Lvl
          </span>
          <CountUp value={prog.level} className="text-lg font-bold leading-none text-amber-200" />
        </div>

        {/* XP bar + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-200 group-hover:text-white truncate">
              {prog.title}
            </span>
            <span className="text-xs tabular-nums text-zinc-500 flex-shrink-0">
              {prog.xpIntoLevel} / {prog.xpForNextLevel} XP
            </span>
          </div>
          <div className="mt-1.5 relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            >
              {pct > 0 && (
                <span
                  className="progress-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  aria-hidden
                />
              )}
            </div>
          </div>
        </div>

        {/* Streak flame */}
        <div
          className="flex flex-col items-center justify-center min-w-[3rem]"
          title={
            streakAtRisk
              ? 'Complete something today to keep your streak alive!'
              : `Current streak: ${prog.streak.current} day${prog.streak.current === 1 ? '' : 's'}`
          }
        >
          <span className={streakAtRisk ? 'opacity-50 grayscale' : ''} aria-hidden>
            🔥
          </span>
          <span className="text-xs font-bold tabular-nums text-orange-300">
            {prog.streak.current}
          </span>
        </div>
      </Link>

      {levelUpNonce > 0 && (
        <LevelUpEffect key={levelUpNonce} level={prog.level} title={prog.title} />
      )}
    </>
  );
}
