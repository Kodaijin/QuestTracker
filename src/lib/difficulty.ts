import { Difficulty } from '@prisma/client';

export interface DifficultyMeta {
  value: Difficulty;
  label: string;
  emoji: string;
  /** Tailwind classes for the small difficulty badge. */
  badgeClass: string;
  /** Border/glow accent applied to a quest card to signal rarity. */
  cardAccent: string;
}

/** Ordered easiest → hardest. Drives selectors and rarity styling. */
export const DIFFICULTIES: DifficultyMeta[] = [
  {
    value: Difficulty.TRIVIAL,
    label: 'Trivial',
    emoji: '⚪',
    badgeClass: 'bg-zinc-800 border border-zinc-600/50 text-zinc-300',
    cardAccent: '',
  },
  {
    value: Difficulty.EASY,
    label: 'Easy',
    emoji: '🟢',
    badgeClass: 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300',
    cardAccent: '',
  },
  {
    value: Difficulty.NORMAL,
    label: 'Normal',
    emoji: '🔵',
    badgeClass: 'bg-sky-950/40 border border-sky-500/40 text-sky-300',
    cardAccent: '',
  },
  {
    value: Difficulty.HARD,
    label: 'Hard',
    emoji: '🟣',
    badgeClass: 'bg-violet-950/40 border border-violet-500/40 text-violet-300',
    cardAccent: 'shadow-[0_0_18px_-4px_rgba(167,139,250,0.5)]',
  },
  {
    value: Difficulty.LEGENDARY,
    label: 'Legendary',
    emoji: '🟠',
    badgeClass: 'bg-amber-950/40 border border-amber-500/50 text-amber-300',
    cardAccent: 'shadow-[0_0_26px_-2px_rgba(251,191,36,0.65)]',
  },
];

const BY_VALUE: Record<Difficulty, DifficultyMeta> = DIFFICULTIES.reduce(
  (acc, d) => {
    acc[d.value] = d;
    return acc;
  },
  {} as Record<Difficulty, DifficultyMeta>,
);

export function difficultyMeta(d: Difficulty): DifficultyMeta {
  return BY_VALUE[d] ?? BY_VALUE[Difficulty.NORMAL];
}
