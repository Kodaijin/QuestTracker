// All date math uses local Date methods (setHours, getDay, getDate, etc.).
// This means "end of day" and "next weekday" are computed in the server's
// local timezone — callers should ensure the server TZ matches expectations.

import { RecurrenceType } from '@prisma/client';

// ── Public interface ──────────────────────────────────────────────────────────

export interface SchedulableQuest {
  recurrenceType: RecurrenceType;
  dayOfWeek: number | null;
  intervalWeeks: number | null;
  dayOfMonth: number | null;
  specificDate: Date | null;
  dueDate: Date | null;
  objectives: { isCompleted: boolean }[];
}

// Subset used by compute functions (no objectives needed for scheduling)
type RecurrenceConfig = Pick<
  SchedulableQuest,
  'recurrenceType' | 'dayOfWeek' | 'intervalWeeks' | 'dayOfMonth' | 'specificDate'
>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Returns the next date (on or after `from`) whose weekday === targetDay (0=Sun..6=Sat). */
function nextWeekday(from: Date, targetDay: number): Date {
  const copy = new Date(from);
  const diff = (targetDay - copy.getDay() + 7) % 7;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/** Returns the last day of the month for a given year/month (0-indexed month). */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Clamps dayOfMonth to the actual last day of the given month. */
function clampedDayOfMonth(year: number, month: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month));
}

// ── Pure exported functions ───────────────────────────────────────────────────

/**
 * Computes the due date for the FIRST occurrence of a quest, anchored to `now`.
 * Returns null for NONE quests.
 */
export function computeFirstDueDate(cfg: RecurrenceConfig, now: Date): Date | null {
  switch (cfg.recurrenceType) {
    case RecurrenceType.NONE:
      return null;

    case RecurrenceType.DAILY:
      return endOfDay(now);

    case RecurrenceType.WEEKLY: {
      // dayOfWeek is required (caller validated)
      const target = nextWeekday(now, cfg.dayOfWeek as number);
      return endOfDay(target);
    }

    case RecurrenceType.EVERY_N_WEEKS: {
      // dayOfWeek is required (caller validated)
      const target = nextWeekday(now, cfg.dayOfWeek as number);
      return endOfDay(target);
    }

    case RecurrenceType.MONTHLY: {
      // dayOfMonth is required (caller validated)
      const dom = cfg.dayOfMonth as number;
      const year = now.getFullYear();
      const month = now.getMonth();
      const clamped = clampedDayOfMonth(year, month, dom);
      const candidate = new Date(year, month, clamped);
      if (clamped >= now.getDate()) {
        // This month works
        return endOfDay(candidate);
      }
      // Next month
      const nextMonth = month + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const nextMonthNorm = nextMonth > 11 ? 0 : nextMonth;
      const nextClamped = clampedDayOfMonth(nextYear, nextMonthNorm, dom);
      return endOfDay(new Date(nextYear, nextMonthNorm, nextClamped));
    }

    case RecurrenceType.SPECIFIC_DATE:
      // specificDate is required (caller validated)
      return endOfDay(cfg.specificDate as Date);
  }
}

/**
 * Computes the due date for the occurrence AFTER `currentDue`.
 * Returns null when there is no next occurrence (NONE or SPECIFIC_DATE).
 */
export function computeNextDueDate(cfg: RecurrenceConfig, currentDue: Date): Date | null {
  switch (cfg.recurrenceType) {
    case RecurrenceType.NONE:
      return null;

    case RecurrenceType.DAILY:
      return endOfDay(addDays(currentDue, 1));

    case RecurrenceType.WEEKLY:
      return endOfDay(addDays(currentDue, 7));

    case RecurrenceType.EVERY_N_WEEKS: {
      const weeks = (cfg.intervalWeeks as number) * 7;
      return endOfDay(addDays(currentDue, weeks));
    }

    case RecurrenceType.MONTHLY: {
      const dom = cfg.dayOfMonth as number;
      // Advance to the following month from currentDue
      const year = currentDue.getFullYear();
      const month = currentDue.getMonth();
      const nextMonth = month + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const nextMonthNorm = nextMonth > 11 ? 0 : nextMonth;
      const nextClamped = clampedDayOfMonth(nextYear, nextMonthNorm, dom);
      return endOfDay(new Date(nextYear, nextMonthNorm, nextClamped));
    }

    case RecurrenceType.SPECIFIC_DATE:
      return null;
  }
}

/**
 * Returns true when the quest has at least one objective and ALL are completed.
 */
export function isCompletedThisCycle(quest: SchedulableQuest): boolean {
  return quest.objectives.length > 0 && quest.objectives.every((o) => o.isCompleted);
}

/**
 * Returns true when the quest's due date has passed and it is NOT completed this cycle.
 */
export function isMissed(quest: SchedulableQuest, now: Date): boolean {
  return quest.dueDate != null && now > quest.dueDate && !isCompletedThisCycle(quest);
}

// ── Human-readable label helpers ──────────────────────────────────────────────

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function weekdayName(day: number): string {
  return WEEKDAY_NAMES[day] ?? 'Sun';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Returns a short human-readable label for use in a UI badge.
 * Examples: 'Daily', 'Weekly · Mon', 'Every 2 weeks · Fri', 'Monthly · 15th', 'Due Jun 20'
 */
export function recurrenceLabel(quest: SchedulableQuest): string {
  switch (quest.recurrenceType) {
    case RecurrenceType.NONE:
      return '';

    case RecurrenceType.DAILY:
      return 'Daily';

    case RecurrenceType.WEEKLY:
      return `Weekly · ${weekdayName(quest.dayOfWeek as number)}`;

    case RecurrenceType.EVERY_N_WEEKS:
      return `Every ${quest.intervalWeeks} weeks · ${weekdayName(quest.dayOfWeek as number)}`;

    case RecurrenceType.MONTHLY:
      return `Monthly · ${ordinal(quest.dayOfMonth as number)}`;

    case RecurrenceType.SPECIFIC_DATE:
      return `Due ${shortDate(quest.specificDate as Date)}`;
  }
}
