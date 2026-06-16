// Pure progression math: XP rewards, leveling curve, rank titles, and streaks.
// No I/O — mirrors the testable style of quest.ts / recurrence.ts. The server
// actions are responsible for reading CompletionEvents and feeding these.

import { Difficulty } from '@prisma/client';

// ── XP reward tables ────────────────────────────────────────────────────────

/** XP for checking off a single objective. Flat — the grind adds up. */
export const OBJECTIVE_XP = 10;

/** XP for gathering a single inventory item. */
export const ITEM_XP = 5;

/** XP awarded when a whole quest is completed, scaled by its difficulty. */
const QUEST_XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  TRIVIAL: 10,
  EASY: 25,
  NORMAL: 50,
  HARD: 100,
  LEGENDARY: 250,
};

export function questXp(difficulty: Difficulty): number {
  return QUEST_XP_BY_DIFFICULTY[difficulty] ?? QUEST_XP_BY_DIFFICULTY.NORMAL;
}

export function objectiveXp(): number {
  return OBJECTIVE_XP;
}

export function itemXp(): number {
  return ITEM_XP;
}

// ── Leveling curve ────────────────────────────────────────────────────────────
//
// Quadratic: total XP required to *reach* level n is 50 * (n - 1)^2.
//   level 1 → 0, level 2 → 50, level 3 → 200, level 4 → 450, level 5 → 800 …
// This makes early levels quick and later levels a meaningful grind.

const LEVEL_COEFFICIENT = 50;

/** Total cumulative XP needed to reach the start of `level` (level ≥ 1). */
export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  return LEVEL_COEFFICIENT * (level - 1) * (level - 1);
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Resolve a total-XP figure into the current level and progress within it. */
export function levelForXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(Math.sqrt(xp / LEVEL_COEFFICIENT)) + 1;
  const start = xpThresholdForLevel(level);
  const next = xpThresholdForLevel(level + 1);
  return {
    level,
    totalXp: xp,
    xpIntoLevel: xp - start,
    xpForNextLevel: next - start,
  };
}

// ── Rank titles ────────────────────────────────────────────────────────────────

const TITLE_TIERS: { minLevel: number; title: string }[] = [
  { minLevel: 50, title: 'Legend' },
  { minLevel: 35, title: 'Hero' },
  { minLevel: 20, title: 'Champion' },
  { minLevel: 10, title: 'Knight' },
  { minLevel: 5, title: 'Squire' },
  { minLevel: 1, title: 'Novice' },
];

/** An evolving rank title for the player's current level. */
export function titleForLevel(level: number): string {
  for (const tier of TITLE_TIERS) {
    if (level >= tier.minLevel) return tier.title;
  }
  return 'Novice';
}

// ── Streaks ─────────────────────────────────────────────────────────────────────
//
// Streaks count distinct *local* calendar days on which the player completed
// something. The action layer converts CompletionEvent timestamps into local
// day keys (so timezone is decided by the caller, not buried here).

/** Local YYYY-MM-DD key for a date. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Days-since-epoch for a YYYY-MM-DD key — used for consecutive-day diffs. */
function keyToDayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastActiveDay: string | null;
}

/**
 * Compute current and longest streaks from a list of active-day keys.
 *
 * - `current` counts back from today, and stays alive if the most recent active
 *   day was today *or* yesterday (so a streak isn't lost until a full day lapses).
 * - `longest` is the longest run of consecutive days anywhere in history.
 */
export function computeStreak(dayKeys: string[], todayKey: string): StreakInfo {
  if (dayKeys.length === 0) {
    return { current: 0, longest: 0, lastActiveDay: null };
  }

  const uniqueDays = Array.from(new Set(dayKeys)).sort();
  const dayNumbers = uniqueDays.map(keyToDayNumber);
  const today = keyToDayNumber(todayKey);

  // Longest run anywhere.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayNumbers.length; i++) {
    if (dayNumbers[i] === dayNumbers[i - 1] + 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  // Current run ending at today or yesterday.
  const lastDay = dayNumbers[dayNumbers.length - 1];
  let current = 0;
  if (lastDay === today || lastDay === today - 1) {
    current = 1;
    for (let i = dayNumbers.length - 1; i > 0; i--) {
      if (dayNumbers[i] === dayNumbers[i - 1] + 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest, lastActiveDay: uniqueDays[uniqueDays.length - 1] };
}
