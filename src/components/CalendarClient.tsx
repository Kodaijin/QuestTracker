'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RecurrenceType } from '@prisma/client';
import type { ProjectWithRelations } from '@/app/actions/projects';
import { occurrencesInRange } from '@/lib/recurrence';
import { dayKey } from '@/lib/progression';
import { difficultyMeta } from '@/lib/difficulty';
import LogoutButton from '@/components/LogoutButton';
import { cn } from '@/lib/utils';

interface Props {
  initialProjects: ProjectWithRelations[];
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarClient({ initialProjects }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const todayKey = dayKey(today);

  // The visible 6-week grid: start on the Sunday on/before the 1st.
  const { gridStart, gridDays } = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    start.setHours(0, 0, 0, 0);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return { gridStart: start, gridDays: days };
  }, [year, month]);

  // Map each visible day → quests occurring that day.
  const occurrencesByDay = useMemo(() => {
    const map = new Map<string, ProjectWithRelations[]>();
    const rangeStart = new Date(gridStart);
    const rangeEnd = new Date(gridDays[gridDays.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);

    for (const p of initialProjects) {
      if (p.parentId != null) continue; // sub-quests live inside epics
      if (p.recurrenceType === RecurrenceType.NONE) continue;
      const cfg = {
        recurrenceType: p.recurrenceType,
        dayOfWeek: p.dayOfWeek,
        intervalWeeks: p.intervalWeeks,
        dayOfMonth: p.dayOfMonth,
        specificDate: p.specificDate ? new Date(p.specificDate) : null,
      };
      for (const occ of occurrencesInRange(cfg, rangeStart, rangeEnd)) {
        const key = dayKey(occ);
        const arr = map.get(key) ?? [];
        arr.push(p);
        map.set(key, arr);
      }
    }
    return map;
  }, [initialProjects, gridStart, gridDays]);

  function shiftMonth(delta: number) {
    const m = month + delta;
    const d = new Date(year, m, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>
        <LogoutButton />
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
          🗓 {MONTH_NAMES[month]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 px-3 py-1.5 text-sm transition-all"
          >
            ←
          </button>
          <button
            onClick={goToday}
            className="rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 px-3 py-1.5 text-sm transition-all"
          >
            Today
          </button>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 px-3 py-1.5 text-sm transition-all"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-zinc-800 bg-zinc-800">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="bg-zinc-900 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {d}
          </div>
        ))}
        {gridDays.map((d) => {
          const key = dayKey(d);
          const inMonth = d.getMonth() === month;
          const isToday = key === todayKey;
          const quests = occurrencesByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                'min-h-[5.5rem] bg-zinc-950/80 px-1.5 py-1.5 flex flex-col gap-1',
                !inMonth && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'text-xs tabular-nums self-end',
                  isToday
                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 font-bold text-zinc-950'
                    : 'text-zinc-500',
                )}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {quests.slice(0, 3).map((q) => {
                  const diff = difficultyMeta(q.difficulty);
                  return (
                    <Link
                      key={q.id}
                      href={`/projects/${q.id}`}
                      title={q.title}
                      className={cn(
                        'truncate rounded px-1 py-0.5 text-[0.65rem] font-medium leading-tight hover:brightness-125 transition',
                        diff.badgeClass,
                      )}
                    >
                      {q.title}
                    </Link>
                  );
                })}
                {quests.length > 3 && (
                  <span className="text-[0.6rem] text-zinc-500 px-1">+{quests.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Shows scheduled & recurring quests. One-off quests without a date don&apos;t appear here.
      </p>
    </main>
  );
}
