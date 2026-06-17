// Pure companion logic: stage is derived from the hero's level, mood from streak
// recency. No I/O — mirrors the testable style of progression.ts. The Pet record
// (src/app/actions/pet.ts) only stores identity (species + name).

import type { StreakInfo } from '@/lib/progression';

// ── Species ─────────────────────────────────────────────────────────────────

export const PET_SPECIES = [
  { id: 'dragon', label: 'Dragon', emoji: '🐉' },
  { id: 'fox', label: 'Fox Spirit', emoji: '🦊' },
  { id: 'slime', label: 'Slime', emoji: '🟢' },
] as const;

export type PetSpeciesId = (typeof PET_SPECIES)[number]['id'];

export const PET_SPECIES_IDS = PET_SPECIES.map((s) => s.id) as [PetSpeciesId, ...PetSpeciesId[]];

function speciesEmoji(species: string): string {
  return PET_SPECIES.find((s) => s.id === species)?.emoji ?? '🐉';
}

// ── Stages (by hero level) ──────────────────────────────────────────────────

const STAGE_TIERS = [
  { min: 1, label: 'Egg' },
  { min: 3, label: 'Hatchling' },
  { min: 7, label: 'Juvenile' },
  { min: 15, label: 'Adult' },
  { min: 30, label: 'Mythic' },
] as const;

export interface PetStage {
  index: number;
  label: string;
  /** Emoji to render: a universal egg at stage 0, otherwise the species creature. */
  emoji: string;
  /** Decorative aura for higher stages ('' | '✨' | '👑'). */
  aura: string;
  /** Level at which the next evolution unlocks, or null at the final stage. */
  nextLevel: number | null;
}

/** Resolve the pet's visual stage from the hero's current level. */
export function petStage(level: number, species: string): PetStage {
  let index = 0;
  for (let i = 0; i < STAGE_TIERS.length; i++) {
    if (level >= STAGE_TIERS[i].min) index = i;
  }
  const tier = STAGE_TIERS[index];
  const next = STAGE_TIERS[index + 1] ?? null;
  return {
    index,
    label: tier.label,
    emoji: index === 0 ? '🥚' : speciesEmoji(species),
    aura: index >= 4 ? '👑' : index >= 3 ? '✨' : '',
    nextLevel: next ? next.min : null,
  };
}

// ── Mood (by streak recency) ────────────────────────────────────────────────

export type PetMood = 'happy' | 'content' | 'sad' | 'hungry';

export const MOOD_META: Record<
  PetMood,
  { label: string; icon: string; blurb: (name: string) => string }
> = {
  happy: {
    label: 'Happy',
    icon: '😄',
    blurb: (n) => `${n} is thrilled you showed up today!`,
  },
  content: {
    label: 'Content',
    icon: '🙂',
    blurb: (n) => `${n} is doing well — keep the streak alive.`,
  },
  sad: {
    label: 'Sad',
    icon: '😟',
    blurb: (n) => `${n} misses you. Complete something today!`,
  },
  hungry: {
    label: 'Hungry',
    icon: '🍖',
    blurb: (n) => `${n} is hungry for XP — finish a quest to feed it.`,
  },
};

/** Whole-day difference between two YYYY-MM-DD keys (a - b). */
function dayDiff(a: string, b: string): number {
  const toNum = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  return toNum(a) - toNum(b);
}

/**
 * Mood from how recently the hero was active:
 * today → happy, yesterday → content, 2 days → sad, 3+ → hungry.
 * A brand-new hero with no activity yet is content (just hatched).
 */
export function petMood(streak: StreakInfo, todayKey: string): PetMood {
  if (!streak.lastActiveDay) return 'content';
  const since = dayDiff(todayKey, streak.lastActiveDay);
  if (since <= 0) return 'happy';
  if (since === 1) return 'content';
  if (since === 2) return 'sad';
  return 'hungry';
}
