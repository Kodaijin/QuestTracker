// Pure helpers for the "becomes active later" (availableAt) and "finish by"
// (deadline) quest timing features. All math uses local calendar days.

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function dayDiff(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** A quest is "upcoming" when it has an availableAt in the future. */
export function isUpcoming(availableAt: Date | string | null, now: Date): boolean {
  if (!availableAt) return false;
  return new Date(availableAt) > now;
}

export type CountdownTone = 'normal' | 'soon' | 'overdue';

export interface Countdown {
  label: string;
  tone: CountdownTone;
}

/**
 * Human-readable countdown to a deadline. Returns null when there's no deadline
 * or the quest is already complete (nothing left to count down).
 */
export function deadlineCountdown(
  deadline: Date | string | null,
  now: Date,
  isComplete: boolean,
): Countdown | null {
  if (!deadline || isComplete) return null;
  const diff = dayDiff(now, new Date(deadline));
  if (diff < 0) {
    const n = -diff;
    return { label: `Overdue by ${n} day${n === 1 ? '' : 's'}`, tone: 'overdue' };
  }
  if (diff === 0) return { label: 'Due today', tone: 'soon' };
  if (diff === 1) return { label: 'Due tomorrow', tone: 'soon' };
  if (diff <= 3) return { label: `${diff} days left`, tone: 'soon' };
  return { label: `${diff} days left`, tone: 'normal' };
}

/** "tomorrow" / "in 5 days" / "in 3 weeks" until a quest becomes active. */
export function formatActivatesIn(availableAt: Date | string, now: Date): string {
  const diff = dayDiff(now, new Date(availableAt));
  if (diff <= 0) return 'now';
  if (diff === 1) return 'tomorrow';
  if (diff < 14) return `in ${diff} days`;
  return `in ${Math.round(diff / 7)} weeks`;
}
