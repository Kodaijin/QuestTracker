'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecurrenceType } from '@prisma/client';
import { useProjectStore } from '@/store/useProjectStore';
import { createProject, deleteProject } from '@/app/actions/projects';
import type { ProjectWithRelations } from '@/app/actions/projects';
import { recurrenceLabel, isMissed } from '@/lib/recurrence';
import { getQuestStatus, questProgress, type QuestStatus } from '@/lib/quest';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import IconPicker from '@/components/IconPicker';
import LogoutButton from '@/components/LogoutButton';
import CountUp from '@/components/CountUp';

interface Props {
  initialProjects: ProjectWithRelations[];
}

const statusCardStyles: Record<QuestStatus, string> = {
  accepted: 'border-zinc-700/60 group-hover:border-zinc-500/70',
  'in-progress': 'border-indigo-500/40 group-hover:border-indigo-400/70',
  completed: 'border-emerald-500/40 group-hover:border-emerald-400/70',
};

const WEEKDAY_OPTIONS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

export default function DashboardClient({ initialProjects }: Props) {
  const router = useRouter();
  const hydrate = useProjectStore((s) => s.hydrate);
  const storeProjects = useProjectStore((s) => s.projects);
  const optimisticDeleteProj = useProjectStore((s) => s.optimisticDeleteProject);
  const rollbackDeleteProj = useProjectStore((s) => s.rollbackDeleteProject);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [items, setItems] = useState<string[]>([]);
  const [icon, setIcon] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCompleted, setShowCompleted] = useState(true);

  // ── Epic state ──────────────────────────────────────────────────────────────
  const [isEpic, setIsEpic] = useState(false);
  const [sequential, setSequential] = useState(false);
  const [subQuests, setSubQuests] = useState<string[]>(['']);

  // ── Recurrence state ──────────────────────────────────────────────────────────
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(RecurrenceType.NONE);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [intervalWeeks, setIntervalWeeks] = useState<number>(2);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [specificDate, setSpecificDate] = useState<string>('');

  useEffect(() => {
    hydrate(initialProjects);
  }, [hydrate, initialProjects]);

  const projects = storeProjects.length > 0 ? storeProjects : initialProjects;

  // Only top-level quests (and epics) appear on the dashboard; sub-quests live
  // inside their epic. The full `projects` list is still passed to the helpers so
  // epic progress can be resolved from its children.
  const topLevel = projects.filter((p) => p.parentId == null);

  // ── Stats (mutually exclusive buckets) ────────────────────────────────────────
  const accepted = topLevel.filter((p) => getQuestStatus(p, projects) === 'accepted').length;
  const inProgress = topLevel.filter((p) => getQuestStatus(p, projects) === 'in-progress').length;
  const completed = topLevel.filter((p) => getQuestStatus(p, projects) === 'completed').length;

  // ── Partitioned quest lists ───────────────────────────────────────────────────
  const activeProjects = topLevel.filter((p) => getQuestStatus(p, projects) !== 'completed');
  const completedProjects = topLevel.filter((p) => getQuestStatus(p, projects) === 'completed');

  function resetForm() {
    setTitle('');
    setDescription('');
    setObjectives(['']);
    setItems([]);
    setIcon(null);
    setError(null);
    setShowForm(false);
    setIsEpic(false);
    setSequential(false);
    setSubQuests(['']);
    setRecurrenceType(RecurrenceType.NONE);
    setDayOfWeek(1);
    setIntervalWeeks(2);
    setDayOfMonth(1);
    setSpecificDate('');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    // ── Epic quest: title + (optional) sub-quest titles + sequencing ────────────
    if (isEpic) {
      const trimmedSubQuests = subQuests.map((s) => s.trim()).filter(Boolean);
      startTransition(async () => {
        try {
          await createProject({
            title: trimmedTitle,
            description: description.trim() || undefined,
            icon: icon ?? undefined,
            isEpic: true,
            sequential,
            subQuests: trimmedSubQuests,
          });
          resetForm();
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create epic quest');
        }
      });
      return;
    }

    // ── Normal quest ────────────────────────────────────────────────────────────
    const trimmedObjectives = objectives.map((o) => o.trim()).filter(Boolean);
    if (trimmedObjectives.length === 0) {
      setError('Add at least one objective');
      return;
    }

    if (recurrenceType === RecurrenceType.SPECIFIC_DATE && !specificDate) {
      setError('Please choose a specific date for the recurrence');
      return;
    }

    const recurrencePayload = buildRecurrencePayload();

    startTransition(async () => {
      try {
        await createProject({
          title: trimmedTitle,
          description: description.trim() || undefined,
          objectives: trimmedObjectives,
          inventoryItems: items.map((i) => i.trim()).filter(Boolean),
          icon: icon ?? undefined,
          ...recurrencePayload,
        });
        resetForm();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create quest');
      }
    });
  }

  function updateSubQuest(index: number, value: string) {
    setSubQuests((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addSubQuestField() {
    setSubQuests((prev) => [...prev, '']);
  }

  function removeSubQuestField(index: number) {
    setSubQuests((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  function updateObjective(index: number, value: string) {
    setObjectives((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addObjectiveField() {
    setObjectives((prev) => [...prev, '']);
  }

  function removeObjectiveField(index: number) {
    setObjectives((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? value : it)));
  }

  function addItemField() {
    setItems((prev) => [...prev, '']);
  }

  function removeItemField(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function buildRecurrencePayload() {
    switch (recurrenceType) {
      case RecurrenceType.NONE:
        return { recurrenceType: RecurrenceType.NONE };
      case RecurrenceType.DAILY:
        return { recurrenceType: RecurrenceType.DAILY };
      case RecurrenceType.WEEKLY:
        return { recurrenceType: RecurrenceType.WEEKLY, dayOfWeek };
      case RecurrenceType.EVERY_N_WEEKS:
        return { recurrenceType: RecurrenceType.EVERY_N_WEEKS, dayOfWeek, intervalWeeks };
      case RecurrenceType.MONTHLY:
        return { recurrenceType: RecurrenceType.MONTHLY, dayOfMonth };
      case RecurrenceType.SPECIFIC_DATE:
        return {
          recurrenceType: RecurrenceType.SPECIFIC_DATE,
          specificDate: new Date(`${specificDate}T12:00:00`).toISOString(),
        };
    }
  }

  async function handleDeleteProject(projectId: string, projectTitle: string) {
    if (!window.confirm(`Delete quest "${projectTitle}"? This cannot be undone.`)) return;
    const saved = optimisticDeleteProj(projectId);
    try {
      await deleteProject({ projectId });
    } catch {
      if (saved) rollbackDeleteProj(saved);
    }
  }

  function renderQuestCard(project: ProjectWithRelations, index = 0) {
    const { done, total } = questProgress(project, projects);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const status = getQuestStatus(project, projects);
    const unit = project.isEpic ? 'sub-quest' : 'objective';
    const missed = isMissed(
      {
        ...project,
        dueDate: project.dueDate ? new Date(project.dueDate) : null,
        specificDate: project.specificDate ? new Date(project.specificDate) : null,
      },
      new Date(),
    );
    const label = recurrenceLabel({
      ...project,
      dueDate: project.dueDate ? new Date(project.dueDate) : null,
      specificDate: project.specificDate ? new Date(project.specificDate) : null,
    });

    const borderClass = missed
      ? 'border-red-500/50 group-hover:border-red-400/70'
      : statusCardStyles[status];

    return (
      <div
        key={project.id}
        className="animate-card-enter relative group"
        style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
      >
        <Link
          href={`/projects/${project.id}`}
          className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Card className={cn('h-full transition-all duration-200 group-hover:shadow-glow group-hover:-translate-y-0.5', borderClass)}>
            <CardHeader>
              <CardTitle className={cn('transition-colors pr-6', status === 'completed' ? 'text-zinc-600 line-through' : 'group-hover:text-white')}>
                <span className="flex items-center gap-2">
                  {project.icon && (
                    <img
                      src={project.icon}
                      alt=""
                      loading="lazy"
                      className="h-8 w-8 object-contain flex-shrink-0"
                    />
                  )}
                  {project.title}
                </span>
              </CardTitle>
              {(label || missed || project.isEpic) && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {project.isEpic && (
                    <span className="inline-flex items-center rounded-md bg-amber-950/40 border border-amber-500/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                      ⚔ Epic{project.sequential ? ' · in order' : ''}
                    </span>
                  )}
                  {label && (
                    <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                      {label}
                    </span>
                  )}
                  {missed && (
                    <span className="inline-flex items-center rounded-md bg-red-950/50 border border-red-500/40 px-2 py-0.5 text-xs font-medium text-red-300">
                      ⚠ Missed
                    </span>
                  )}
                </div>
              )}
              {project.description && (
                <p className="mt-1 text-sm text-zinc-400 leading-snug line-clamp-2">
                  {project.description}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>
                    {done}/{total} {unit}{total !== 1 ? 's' : ''}
                  </span>
                  <span className="font-medium text-zinc-300">{pct}%</span>
                </div>
                <Progress value={pct} />
                {!project.isEpic && project.inventoryItems.length > 0 && (
                  <p className="text-xs text-zinc-500 pt-1">
                    {project.inventoryItems.length} inventory item
                    {project.inventoryItems.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
        <button
          onClick={(e) => {
            e.stopPropagation();
            void handleDeleteProject(project.id, project.title);
          }}
          aria-label={`Delete "${project.title}"`}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 text-sm px-1 z-10"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
            Your Quests
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track your objectives and loot, one quest at a time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>+ New Quest</Button>
          )}
          <Link
            href="/achievements"
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all"
          >
            🏆 Achievements
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all"
          >
            Settings
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 flex flex-col items-center gap-0.5">
          <CountUp value={accepted} className="text-2xl font-bold tabular-nums text-zinc-100" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Accepted</span>
        </div>
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-3 flex flex-col items-center gap-0.5">
          <CountUp value={inProgress} className="text-2xl font-bold tabular-nums text-indigo-300" />
          <span className="text-xs font-medium text-indigo-400 uppercase tracking-wide">In Progress</span>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 flex flex-col items-center gap-0.5">
          <CountUp value={completed} className="text-2xl font-bold tabular-nums text-emerald-300" />
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Completed</span>
        </div>
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="quest-title"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Title
                </label>
                <input
                  id="quest-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  className="field"
                  placeholder="Defeat the backlog dragon"
                />
              </div>

              <div>
                <label
                  htmlFor="quest-description"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Description <span className="text-zinc-500">(optional)</span>
                </label>
                <textarea
                  id="quest-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="field resize-none"
                  placeholder="What does success look like?"
                />
              </div>

              {/* Epic Quest toggle */}
              <label className="flex items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEpic}
                  onChange={(e) => setIsEpic(e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                <span className="text-sm text-zinc-200">
                  ⚔ Epic Quest <span className="text-zinc-500">— made of sub-quests instead of objectives</span>
                </span>
              </label>

              {!isEpic && (
                <>
              {/* Objectives (at least one required) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Objectives <span className="text-zinc-500">(at least one)</span>
                </label>
                <div className="space-y-2">
                  {objectives.map((obj, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={obj}
                        onChange={(e) => updateObjective(index, e.target.value)}
                        className="field flex-1"
                        placeholder={`Objective ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeObjectiveField(index)}
                        disabled={objectives.length === 1}
                        aria-label={`Remove objective ${index + 1}`}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addObjectiveField}
                  className="mt-2"
                >
                  + Add objective
                </Button>
              </div>

              {/* Inventory items (optional) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Inventory <span className="text-zinc-500">(optional — items needed for the quest)</span>
                </label>
                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateItem(index, e.target.value)}
                          className="field flex-1"
                          placeholder={`Item ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItemField(index)}
                          aria-label={`Remove item ${index + 1}`}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addItemField}
                  className="mt-2"
                >
                  + Add item
                </Button>
              </div>
                </>
              )}

              {isEpic && (
                <>
                  {/* Sub-quests */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Sub-quests <span className="text-zinc-500">(optional now — flesh each one out later)</span>
                    </label>
                    {subQuests.length > 0 && (
                      <div className="space-y-2">
                        {subQuests.map((sub, index) => (
                          <div key={index} className="flex gap-2">
                            <span className="flex items-center text-xs text-zinc-500 w-5 justify-end">
                              {index + 1}.
                            </span>
                            <input
                              type="text"
                              value={sub}
                              onChange={(e) => updateSubQuest(index, e.target.value)}
                              className="field flex-1"
                              placeholder={`Sub-quest ${index + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSubQuestField(index)}
                              disabled={subQuests.length === 1}
                              aria-label={`Remove sub-quest ${index + 1}`}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addSubQuestField}
                      className="mt-2"
                    >
                      + Add sub-quest
                    </Button>
                  </div>

                  {/* Sequential toggle */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sequential}
                      onChange={(e) => setSequential(e.target.checked)}
                      className="h-4 w-4 accent-amber-500"
                    />
                    <span className="text-sm text-zinc-200">
                      Sub-quests must be done in order
                      <span className="text-zinc-500"> — later ones stay locked 🔒 until earlier ones are complete</span>
                    </span>
                  </label>
                </>
              )}

              {/* Icon picker */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Icon <span className="text-zinc-500">(optional)</span>
                </label>
                <IconPicker value={icon} onChange={setIcon} disabled={isPending} />
              </div>

              {!isEpic && (
                <>
              {/* Repeat / Recurrence section */}
              <div>
                <label
                  htmlFor="quest-recurrence"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Repeat
                </label>
                <select
                  id="quest-recurrence"
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="field"
                >
                  <option value={RecurrenceType.NONE}>None</option>
                  <option value={RecurrenceType.DAILY}>Daily</option>
                  <option value={RecurrenceType.WEEKLY}>Weekly</option>
                  <option value={RecurrenceType.EVERY_N_WEEKS}>Every N weeks</option>
                  <option value={RecurrenceType.MONTHLY}>Monthly</option>
                  <option value={RecurrenceType.SPECIFIC_DATE}>Specific date</option>
                </select>
              </div>

              {recurrenceType === RecurrenceType.WEEKLY && (
                <div>
                  <label
                    htmlFor="quest-dow"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    Day of week
                  </label>
                  <select
                    id="quest-dow"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="field"
                  >
                    {WEEKDAY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {recurrenceType === RecurrenceType.EVERY_N_WEEKS && (
                <>
                  <div>
                    <label
                      htmlFor="quest-interval"
                      className="block text-sm font-medium text-zinc-300 mb-1.5"
                    >
                      Every N weeks
                    </label>
                    <input
                      id="quest-interval"
                      type="number"
                      min={1}
                      value={intervalWeeks}
                      onChange={(e) => setIntervalWeeks(Math.max(1, Number(e.target.value)))}
                      className="field"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="quest-dow-n"
                      className="block text-sm font-medium text-zinc-300 mb-1.5"
                    >
                      Day of week
                    </label>
                    <select
                      id="quest-dow-n"
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number(e.target.value))}
                      className="field"
                    >
                      {WEEKDAY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {recurrenceType === RecurrenceType.MONTHLY && (
                <div>
                  <label
                    htmlFor="quest-dom"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    Day of month
                  </label>
                  <input
                    id="quest-dom"
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) =>
                      setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))
                    }
                    className="field"
                  />
                </div>
              )}

              {recurrenceType === RecurrenceType.SPECIFIC_DATE && (
                <div>
                  <label
                    htmlFor="quest-specific-date"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    Date
                  </label>
                  <input
                    id="quest-specific-date"
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="field"
                  />
                </div>
              )}
                </>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Creating…' : isEpic ? 'Create Epic' : 'Create Quest'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-16 text-center text-zinc-500">
          No quests yet — create one to begin your adventure.
        </div>
      ) : (
        <>
          {/* Active quests section */}
          {activeProjects.length === 0 && completedProjects.length > 0 ? (
            <p className="text-sm text-zinc-500">No active quests.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeProjects.map((project, i) => renderQuestCard(project, i))}
            </div>
          )}

          {/* Completed quests section */}
          {completedProjects.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowCompleted((prev) => !prev)}
                aria-expanded={showCompleted}
                className="w-full flex items-center gap-3 mt-10 mb-5 text-left group"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={cn(
                    'w-4 h-4 text-emerald-400/80 flex-shrink-0 transition-transform duration-200',
                    showCompleted ? 'rotate-90' : 'rotate-0'
                  )}
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-emerald-400/80 whitespace-nowrap">
                  Completed · {completedProjects.length}
                </span>
                <span className="flex-1 h-px bg-zinc-800" />
              </button>

              {showCompleted && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {completedProjects.map((project, i) => renderQuestCard(project, i))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
