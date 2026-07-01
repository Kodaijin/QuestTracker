// All date math uses local Date methods (setHours, getDay, getDate, etc.).
// This means "end of day" and "next weekday" are computed in the server's
// local timezone — callers should ensure the server TZ matches expectations.

import { RecurrenceType } from '@prisma/client';

// ── Public interface ──────────────────────────────────────────────────────────

export interface SchedulableQuest {
  recurrenceType: RecurrenceType;
  dayOfWeek: number | null;
  intervalWeeks: number | null;
  intervalDays: number | null;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  specificDate: Date | null;
  dueDate: Date | null;
  objectives: { isCompleted: boolean }[];
}

// Subset used by compute functions (no objectives needed for scheduling)
type RecurrenceConfig = Pick<
  SchedulableQuest,
  | 'recurrenceType'
  | 'dayOfWeek'
  | 'intervalWeeks'
  | 'intervalDays'
  | 'daysOfWeek'
  | 'dayOfMonth'
  | 'specificDate'
>;

// ── Helpers ───────────────────────────────────────────────────────────────────

// The reset hour defines the day boundary: a "logical day" runs from
// `resetHour:00` to `resetHour:00` the next calendar day. `resetHour = 0`
// reproduces the previous plain-midnight behaviour (due at 23:59:59.999).

/**
 * The local calendar day that `d` belongs to, given a day boundary at
 * `resetHour`. Returned as a Date at local midnight of that day. E.g. with
 * resetHour=4, 2 AM Tuesday belongs to (Monday) — anything before 4 AM counts
 * toward the previous day.
 */
function logicalDate(d: Date, resetHour: number): Date {
  const copy = new Date(d);
  copy.setHours(copy.getHours() - resetHour); // shift into the logical day
  copy.setHours(0, 0, 0, 0); // truncate to local midnight of that day
  return copy;
}

/**
 * The due instant that ends the logical day `logical` (a local-midnight Date):
 * the next calendar day at `resetHour:00:00.000`, minus 1ms. With resetHour=0
 * this is the same day at 23:59:59.999.
 */
function boundaryForDate(logical: Date, resetHour: number): Date {
  const b = new Date(logical);
  b.setDate(b.getDate() + 1);
  b.setHours(resetHour, 0, 0, 0);
  return new Date(b.getTime() - 1);
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

/**
 * Earliest date (on or after `from`) whose weekday is in `days` (0=Sun..6=Sat).
 * Returns null when `days` is empty.
 */
function nextSelectedWeekday(from: Date, days: number[]): Date | null {
  let best: Date | null = null;
  for (const d of days) {
    const cand = nextWeekday(from, d);
    if (best == null || cand < best) best = cand;
  }
  return best;
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
 * The due instant that ends the logical day containing `d`, given `resetHour`
 * (0-23). Used to anchor roll-over math on completion timestamps.
 */
export function endOfLogicalDay(d: Date, resetHour: number): Date {
  return boundaryForDate(logicalDate(d, resetHour), resetHour);
}

/**
 * Computes the due date for the FIRST occurrence of a quest, anchored to `now`.
 * `resetHour` (0-23) sets the daily rollover boundary. Returns null for NONE.
 */
export function computeFirstDueDate(
  cfg: RecurrenceConfig,
  now: Date,
  resetHour: number,
): Date | null {
  // Anchor all weekday / day-of-month math on the logical day of `now`.
  const today = logicalDate(now, resetHour);

  switch (cfg.recurrenceType) {
    case RecurrenceType.NONE:
      return null;

    case RecurrenceType.DAILY:
      return boundaryForDate(today, resetHour);

    case RecurrenceType.WEEKLY: {
      // dayOfWeek is required (caller validated)
      const target = nextWeekday(today, cfg.dayOfWeek as number);
      return boundaryForDate(target, resetHour);
    }

    case RecurrenceType.EVERY_N_WEEKS: {
      // dayOfWeek is required (caller validated)
      const target = nextWeekday(today, cfg.dayOfWeek as number);
      return boundaryForDate(target, resetHour);
    }

    case RecurrenceType.EVERY_N_DAYS:
      // First occurrence is today; subsequent ones step by intervalDays.
      return boundaryForDate(today, resetHour);

    case RecurrenceType.DAYS_OF_WEEK: {
      // The soonest selected weekday on or after today (daysOfWeek validated non-empty).
      const target = nextSelectedWeekday(today, cfg.daysOfWeek);
      return target ? boundaryForDate(target, resetHour) : null;
    }

    case RecurrenceType.MONTHLY: {
      // dayOfMonth is required (caller validated)
      const dom = cfg.dayOfMonth as number;
      const year = today.getFullYear();
      const month = today.getMonth();
      const clamped = clampedDayOfMonth(year, month, dom);
      const candidate = new Date(year, month, clamped);
      if (clamped >= today.getDate()) {
        // This month works
        return boundaryForDate(candidate, resetHour);
      }
      // Next month
      const nextMonth = month + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const nextMonthNorm = nextMonth > 11 ? 0 : nextMonth;
      const nextClamped = clampedDayOfMonth(nextYear, nextMonthNorm, dom);
      return boundaryForDate(new Date(nextYear, nextMonthNorm, nextClamped), resetHour);
    }

    case RecurrenceType.SPECIFIC_DATE:
      // specificDate is required (caller validated)
      return boundaryForDate(logicalDate(cfg.specificDate as Date, resetHour), resetHour);
  }
}

/**
 * Computes the due date for the occurrence AFTER `currentDue`.
 * `resetHour` (0-23) sets the daily rollover boundary.
 * Returns null when there is no next occurrence (NONE or SPECIFIC_DATE).
 */
export function computeNextDueDate(
  cfg: RecurrenceConfig,
  currentDue: Date,
  resetHour: number,
): Date | null {
  // The logical day the current occurrence belongs to; step forward from it.
  const day = logicalDate(currentDue, resetHour);

  switch (cfg.recurrenceType) {
    case RecurrenceType.NONE:
      return null;

    case RecurrenceType.DAILY:
      return boundaryForDate(addDays(day, 1), resetHour);

    case RecurrenceType.WEEKLY:
      return boundaryForDate(addDays(day, 7), resetHour);

    case RecurrenceType.EVERY_N_WEEKS: {
      const weeks = (cfg.intervalWeeks as number) * 7;
      return boundaryForDate(addDays(day, weeks), resetHour);
    }

    case RecurrenceType.EVERY_N_DAYS:
      return boundaryForDate(addDays(day, cfg.intervalDays as number), resetHour);

    case RecurrenceType.DAYS_OF_WEEK: {
      // The next selected weekday strictly after the current logical day.
      const target = nextSelectedWeekday(addDays(day, 1), cfg.daysOfWeek);
      return target ? boundaryForDate(target, resetHour) : null;
    }

    case RecurrenceType.MONTHLY: {
      const dom = cfg.dayOfMonth as number;
      // Advance to the following month from the current logical day
      const year = day.getFullYear();
      const month = day.getMonth();
      const nextMonth = month + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const nextMonthNorm = nextMonth > 11 ? 0 : nextMonth;
      const nextClamped = clampedDayOfMonth(nextYear, nextMonthNorm, dom);
      return boundaryForDate(new Date(nextYear, nextMonthNorm, nextClamped), resetHour);
    }

    case RecurrenceType.SPECIFIC_DATE:
      return null;
  }
}

/**
 * Lists every occurrence (due date) of a recurring/scheduled quest that falls
 * within [rangeStart, rangeEnd], inclusive — used to plot quests on a calendar.
 *
 * NONE quests have no occurrences. SPECIFIC_DATE yields its single date if in
 * range. For EVERY_N_WEEKS the interval phase is approximated from rangeStart
 * (the true phase is anchored at creation), which is fine for a visual grid.
 */
export function occurrencesInRange(
  cfg: RecurrenceConfig,
  rangeStart: Date,
  rangeEnd: Date,
  resetHour: number,
): Date[] {
  if (cfg.recurrenceType === RecurrenceType.NONE) return [];

  if (cfg.recurrenceType === RecurrenceType.SPECIFIC_DATE) {
    if (!cfg.specificDate) return [];
    const d = boundaryForDate(logicalDate(cfg.specificDate, resetHour), resetHour);
    return d >= rangeStart && d <= rangeEnd ? [d] : [];
  }

  const out: Date[] = [];
  let due = computeFirstDueDate(cfg, rangeStart, resetHour);
  let guard = 0;
  while (due != null && due <= rangeEnd && guard < 400) {
    if (due >= rangeStart) out.push(due);
    const next = computeNextDueDate(cfg, due, resetHour);
    if (next == null) break;
    due = next;
    guard += 1;
  }
  return out;
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

// ── Cadence categorisation ────────────────────────────────────────────────────

export type QuestCategory = 'daily' | 'weekly' | 'other';

/**
 * Buckets a quest into a broad cadence category for grouped UI display.
 * Daily = DAILY, every-1-day, and multi-weekday (DAYS_OF_WEEK) quests — anything
 * that can come due on several days a week. Weekly = a single weekday (WEEKLY) /
 * every-N-weeks; everything else (one-off, monthly, specific date, every-N-days
 * where N>1) falls under Other.
 */
export function questCategory(quest: {
  recurrenceType: RecurrenceType;
  intervalDays: number | null;
}): QuestCategory {
  switch (quest.recurrenceType) {
    case RecurrenceType.DAILY:
    case RecurrenceType.DAYS_OF_WEEK:
      return 'daily';
    case RecurrenceType.EVERY_N_DAYS:
      return quest.intervalDays === 1 ? 'daily' : 'other';
    case RecurrenceType.WEEKLY:
    case RecurrenceType.EVERY_N_WEEKS:
      return 'weekly';
    default: // NONE, MONTHLY, SPECIFIC_DATE
      return 'other';
  }
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

    case RecurrenceType.EVERY_N_DAYS:
      return quest.intervalDays === 1 ? 'Daily' : `Every ${quest.intervalDays} days`;

    case RecurrenceType.DAYS_OF_WEEK:
      return [...quest.daysOfWeek].sort((a, b) => a - b).map(weekdayName).join(', ');

    case RecurrenceType.MONTHLY:
      return `Monthly · ${ordinal(quest.dayOfMonth as number)}`;

    case RecurrenceType.SPECIFIC_DATE:
      return `Due ${shortDate(quest.specificDate as Date)}`;
  }
}
