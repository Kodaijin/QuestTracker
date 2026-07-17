'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecurrenceType } from '@prisma/client';
import { useProjectStore } from '@/store/useProjectStore';
import { skipQuestToday, type ProjectWithRelations } from '@/app/actions/projects';
import {
  recurrenceLabel,
  isMissed,
  endOfLogicalDay,
  questCategory,
  type QuestCategory,
} from '@/lib/recurrence';
import { getQuestStatus, questProgress } from '@/lib/quest';
import { difficultyMeta } from '@/lib/difficulty';
import { isUpcoming, deadlineCountdown } from '@/lib/timing';
import { Progress } from '@/components/ui/progress';
import LogoutButton from '@/components/LogoutButton';
import PartyNavLink from '@/components/PartyNavLink';
import NotificationBell from '@/components/NotificationBell';
import ShopNavLink from '@/components/ShopNavLink';
import { cn } from '@/lib/utils';

interface Props {
  initialProjects: ProjectWithRelations[];
  resetHour: number;
}

// Cadence containers. Order here is the display order.
const CATEGORY_META: { key: QuestCategory; label: string; border: string; accent: string }[] = [
  { key: 'daily', label: '☀ Daily', border: 'border-amber-500/30', accent: 'text-amber-300' },
  { key: 'weekly', label: '🗓 Weekly', border: 'border-indigo-500/30', accent: 'text-indigo-300' },
  { key: 'other', label: '◆ Other', border: 'border-zinc-800/80', accent: 'text-zinc-400' },
];

/** Effective due date for sorting — a finish-by deadline takes priority. */
function effectiveDueTime(project: ProjectWithRelations): number {
  const due = project.deadline ?? project.dueDate;
  return due ? new Date(due).getTime() : Number.POSITIVE_INFINITY;
}

export default function TodayClient({ initialProjects, resetHour }: Props) {
  const hydrate = useProjectStore((s) => s.hydrate);
  const storeProjects = useProjectStore((s) => s.projects);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    hydrate(initialProjects);
  }, [hydrate, initialProjects]);

  const projects = storeProjects.length > 0 ? storeProjects : initialProjects;
  const now = new Date();

  // Skip today's occurrence of a repeating quest: drop the current (and any
  // overdue) cycle with no XP and advance to the next scheduled day. A refresh
  // re-runs syncRecurringQuests.
  function handleSkipToday(projectId: string) {
    startTransition(async () => {
      try {
        await skipQuestToday({ projectId });
        router.refresh();
      } catch {
        /* best-effort; a refresh will resync the list */
      }
    });
  }

  // Whether a repeating quest can be skipped for today — it's due today (or
  // overdue), not a one-off/specific-date, and not already finished.
  function canSkipToday(project: ProjectWithRelations): boolean {
    if (
      project.recurrenceType === RecurrenceType.NONE ||
      project.recurrenceType === RecurrenceType.SPECIFIC_DATE ||
      !project.dueDate
    ) {
      return false;
    }
    if (getQuestStatus(project, projects) === 'completed') return false;
    const todayEnd = endOfLogicalDay(now, project.resetHour ?? resetHour);
    return new Date(project.dueDate) <= todayEnd;
  }

  // Active, top-level quests that are available now (upcoming ones are excluded
  // — they're not actionable yet).
  const active = projects.filter(
    (p) =>
      p.parentId == null &&
      getQuestStatus(p, projects) !== 'completed' &&
      !isUpcoming(p.availableAt, now),
  );

  // Group by cadence (Daily / Weekly / Other); within each, most urgent first.
  const grouped: Record<QuestCategory, ProjectWithRelations[]> = {
    daily: [],
    weekly: [],
    other: [],
  };
  for (const p of active) grouped[questCategory(p)].push(p);
  for (const key of Object.keys(grouped) as QuestCategory[]) {
    grouped[key].sort((a, b) => effectiveDueTime(a) - effectiveDueTime(b));
  }

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
    const missed = isMissed(
      {
        ...project,
        dueDate: project.dueDate ? new Date(project.dueDate) : null,
        specificDate: project.specificDate ? new Date(project.specificDate) : null,
      },
      now,
    );
    const skippable = canSkipToday(project);

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
          {missed && (
            <span className="inline-flex items-center rounded-md bg-red-950/50 border border-red-500/40 px-2 py-0.5 font-medium text-red-300">
              ⚠ Missed
            </span>
          )}
          {skippable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSkipToday(project.id);
              }}
              disabled={isPending}
              title="Skip today and pick this quest back up on its next scheduled day"
              aria-label={`Skip "${project.title}" for today`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-600/50 bg-zinc-800 px-2 py-0.5 font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 transition-colors"
            >
              ⏭ Skip today
            </button>
          )}
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
        <div className="flex items-center gap-4">
          <ShopNavLink />
          <NotificationBell />
          <PartyNavLink />
          <LogoutButton />
        </div>
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
        <div className="space-y-6">
          {CATEGORY_META.map(({ key, label, border, accent }) => {
            const items = grouped[key];
            if (items.length === 0) return null;
            return (
              <section key={key} className={cn('rounded-xl border bg-zinc-900/40 p-4', border)}>
                <h2 className={cn('text-sm font-semibold uppercase tracking-wide mb-4', accent)}>
                  {label} · {items.length}
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
