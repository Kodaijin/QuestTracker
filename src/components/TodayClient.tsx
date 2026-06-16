'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useProjectStore } from '@/store/useProjectStore';
import type { ProjectWithRelations } from '@/app/actions/projects';
import { recurrenceLabel, isMissed } from '@/lib/recurrence';
import { getQuestStatus, questProgress } from '@/lib/quest';
import { difficultyMeta } from '@/lib/difficulty';
import { isUpcoming, deadlineCountdown } from '@/lib/timing';
import { Progress } from '@/components/ui/progress';
import LogoutButton from '@/components/LogoutButton';
import { cn } from '@/lib/utils';

interface Props {
  initialProjects: ProjectWithRelations[];
}

type Bucket = 'overdue' | 'today' | 'week' | 'none';

const BUCKET_META: Record<Bucket, { label: string; accent: string }> = {
  overdue: { label: '⚠ Overdue', accent: 'text-red-300' },
  today: { label: '☀ Due today', accent: 'text-amber-300' },
  week: { label: '🗓 This week', accent: 'text-indigo-300' },
  none: { label: '◷ No due date', accent: 'text-zinc-400' },
};

const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'week', 'none'];

/** Midnight (local) at the start of the given date. */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function TodayClient({ initialProjects }: Props) {
  const hydrate = useProjectStore((s) => s.hydrate);
  const storeProjects = useProjectStore((s) => s.projects);

  useEffect(() => {
    hydrate(initialProjects);
  }, [hydrate, initialProjects]);

  const projects = storeProjects.length > 0 ? storeProjects : initialProjects;
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Active, top-level quests that are available now (upcoming ones are excluded
  // — they're not actionable yet).
  const active = projects.filter(
    (p) =>
      p.parentId == null &&
      getQuestStatus(p, projects) !== 'completed' &&
      !isUpcoming(p.availableAt, now),
  );

  function bucketFor(project: ProjectWithRelations): Bucket {
    const schedulable = {
      ...project,
      dueDate: project.dueDate ? new Date(project.dueDate) : null,
      specificDate: project.specificDate ? new Date(project.specificDate) : null,
    };
    // A finish-by deadline takes priority over recurrence due date for bucketing.
    const effectiveDue = project.deadline
      ? new Date(project.deadline)
      : project.dueDate
        ? new Date(project.dueDate)
        : null;
    if (project.deadline == null && isMissed(schedulable, now)) return 'overdue';
    if (!effectiveDue) return 'none';
    if (effectiveDue < todayStart) return 'overdue';
    const dueStart = startOfDay(effectiveDue);
    if (dueStart.getTime() === todayStart.getTime()) return 'today';
    if (effectiveDue <= weekEnd) return 'week';
    return 'none';
  }

  const grouped: Record<Bucket, ProjectWithRelations[]> = {
    overdue: [],
    today: [],
    week: [],
    none: [],
  };
  for (const p of active) grouped[bucketFor(p)].push(p);

  function renderRow(project: ProjectWithRelations) {
    const { done, total } = questProgress(project, projects);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const diff = difficultyMeta(project.difficulty);
    const label = recurrenceLabel({
      ...project,
      dueDate: project.dueDate ? new Date(project.dueDate) : null,
      specificDate: project.specificDate ? new Date(project.specificDate) : null,
    });
    const unit = project.isEpic ? 'sub-quest' : 'objective';
    const countdown = deadlineCountdown(project.deadline, now, false);

    return (
      <Link
        key={project.id}
        href={`/projects/${project.id}`}
        className="block rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 transition-all hover:border-indigo-500/50 hover:bg-zinc-900/80"
      >
        <div className="flex items-center gap-3">
          {project.icon && (
            <img src={project.icon} alt="" loading="lazy" className="h-7 w-7 object-contain flex-shrink-0" />
          )}
          <span className="font-medium text-zinc-100 truncate flex-1">{project.title}</span>
          <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium flex-shrink-0', diff.badgeClass)}>
            <span aria-hidden>{diff.emoji}</span>
            {diff.label}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={pct} className="flex-1" />
          <span className="text-xs text-zinc-500 tabular-nums flex-shrink-0">
            {done}/{total} {unit}{total !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          {countdown && (
            <span
              className={cn(
                'font-medium',
                countdown.tone === 'overdue'
                  ? 'text-red-300'
                  : countdown.tone === 'soon'
                    ? 'text-amber-300'
                    : 'text-zinc-400',
              )}
            >
              ⏳ {countdown.label}
            </span>
          )}
          {label && <span className="text-zinc-500">{label}</span>}
        </div>
      </Link>
    );
  }

  const hasAny = active.length > 0;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>
        <LogoutButton />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">☀ Today</h1>
        <p className="mt-1 text-sm text-zinc-400">
          What needs your attention, sorted by urgency.
        </p>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-16 text-center text-zinc-500">
          Nothing active right now — enjoy the calm, hero.
        </div>
      ) : (
        <div className="space-y-8">
          {BUCKET_ORDER.map((bucket) => {
            const items = grouped[bucket];
            if (items.length === 0) return null;
            return (
              <section key={bucket}>
                <h2 className={cn('text-sm font-semibold uppercase tracking-wide mb-3', BUCKET_META[bucket].accent)}>
                  {BUCKET_META[bucket].label} · {items.length}
                </h2>
                <div className="space-y-2.5">{items.map(renderRow)}</div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
