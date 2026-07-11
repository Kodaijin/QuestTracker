'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RecurrenceType, Difficulty } from '@prisma/client';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '@/store/useProjectStore';
import { createProject, deleteProject, dismissMissedQuest, reorderProjects } from '@/app/actions/projects';
import type { ProjectWithRelations } from '@/app/actions/projects';
import { giveQuest, respondToQuestInvite } from '@/app/actions/party';
import type { Ally, QuestInvite } from '@/app/actions/party';
import { recurrenceLabel, isMissed, questCategory, type QuestCategory } from '@/lib/recurrence';
import { getQuestStatus, questProgress, type QuestStatus } from '@/lib/quest';
import { difficultyMeta, DIFFICULTIES } from '@/lib/difficulty';
import { isUpcoming, deadlineCountdown, formatActivatesIn } from '@/lib/timing';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import IconPicker from '@/components/IconPicker';
import LogoutButton from '@/components/LogoutButton';
import NotificationBell from '@/components/NotificationBell';
import ShopNavLink from '@/components/ShopNavLink';
import CountUp from '@/components/CountUp';
import ProgressionHeader from '@/components/ProgressionHeader';

interface Props {
  initialProjects: ProjectWithRelations[];
  currentUserId: string;
  pendingNoticeCount: number;
  allies: Ally[];
  pendingInvites: QuestInvite[];
}

const statusCardStyles: Record<QuestStatus, string> = {
  accepted: 'border-zinc-700/60 group-hover:border-zinc-500/70',
  'in-progress': 'border-indigo-500/40 group-hover:border-indigo-400/70',
  completed: 'border-emerald-500/40 group-hover:border-emerald-400/70',
};

// Cadence containers for the active board. Order here is the display order.
const CATEGORY_META: { key: QuestCategory; label: string; border: string; accent: string }[] = [
  { key: 'daily', label: '☀ Daily', border: 'border-amber-500/30', accent: 'text-amber-300' },
  { key: 'weekly', label: '🗓 Weekly', border: 'border-indigo-500/30', accent: 'text-indigo-300' },
  { key: 'other', label: '◆ Other', border: 'border-zinc-800/80', accent: 'text-zinc-400' },
];

type AvailabilityPreset = 'now' | '1d' | '1w' | '2w' | '1m' | 'date';

const AVAILABILITY_OPTIONS: { value: AvailabilityPreset; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: '1d', label: 'In 1 day' },
  { value: '1w', label: 'In 1 week' },
  { value: '2w', label: 'In 2 weeks' },
  { value: '1m', label: 'In 1 month' },
  { value: 'date', label: 'On a date…' },
];

const WEEKDAY_OPTIONS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

// Drag-and-drop bag handed to a quest card so it can wire up the sortable wrapper
// and a grip handle. `style` carries the live drag transform.
type SortableBag = Pick<
  ReturnType<typeof useSortable>,
  'setNodeRef' | 'setActivatorNodeRef' | 'attributes' | 'listeners' | 'isDragging'
> & { style: React.CSSProperties };

/** Registers a card as a sortable item and exposes the sortable bag via render-prop. */
function SortableQuestCard({
  id,
  children,
}: {
  id: string;
  children: (bag: SortableBag) => React.ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    attributes,
    listeners,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <>
      {children({ setNodeRef, setActivatorNodeRef, style, attributes, listeners, isDragging })}
    </>
  );
}

export default function DashboardClient({
  initialProjects,
  currentUserId,
  pendingNoticeCount,
  allies,
  pendingInvites,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrate = useProjectStore((s) => s.hydrate);
  const storeProjects = useProjectStore((s) => s.projects);
  const optimisticDeleteProj = useProjectStore((s) => s.optimisticDeleteProject);
  const rollbackDeleteProj = useProjectStore((s) => s.rollbackDeleteProject);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [sequentialObjectives, setSequentialObjectives] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [icon, setIcon] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [availability, setAvailability] = useState<AvailabilityPreset>('now');
  const [availableDate, setAvailableDate] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isReordering, startReorder] = useTransition();
  const [isResponding, startRespond] = useTransition();
  const [showCompleted, setShowCompleted] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(true);

  // ── Search / filter state ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | 'all'>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // ── Party sharing state ───────────────────────────────────────────────────────
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [membersCanEdit, setMembersCanEdit] = useState(true);
  // Party section mode: co-op (share progress) vs give (hand it to one ally to do).
  const [partyMode, setPartyMode] = useState<'coop' | 'give'>('coop');
  const [giveToId, setGiveToId] = useState('');

  // ── Epic state ──────────────────────────────────────────────────────────────
  const [isEpic, setIsEpic] = useState(false);
  const [sequential, setSequential] = useState(false);
  const [subQuests, setSubQuests] = useState<string[]>(['']);

  // ── Recurrence state ──────────────────────────────────────────────────────────
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(RecurrenceType.NONE);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [intervalWeeks, setIntervalWeeks] = useState<number>(2);
  const [intervalDays, setIntervalDays] = useState<number>(2);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [specificDate, setSpecificDate] = useState<string>('');
  // Per-quest reset hour override; null = follow the user's global default.
  const [resetHour, setResetHour] = useState<number | null>(null);

  useEffect(() => {
    hydrate(initialProjects);
  }, [hydrate, initialProjects]);

  // Calendar "click a date to add a quest" deep-link: ?new=1&deadline=YYYY-MM-DD
  useEffect(() => {
    if (searchParams.get('new') == null) return;
    setShowForm(true);
    const d = searchParams.get('deadline');
    if (d) setDeadline(d);
  }, [searchParams]);

  const projects = storeProjects.length > 0 ? storeProjects : initialProjects;

  // Only top-level quests (and epics) appear on the dashboard; sub-quests live
  // inside their epic. The full `projects` list is still passed to the helpers so
  // epic progress can be resolved from its children.
  const topLevel = projects.filter((p) => p.parentId == null);

  // ── Stats (mutually exclusive buckets; always reflect ALL quests) ─────────────
  const accepted = topLevel.filter((p) => getQuestStatus(p, projects) === 'accepted').length;
  const inProgress = topLevel.filter((p) => getQuestStatus(p, projects) === 'in-progress').length;
  const completed = topLevel.filter((p) => getQuestStatus(p, projects) === 'completed').length;

  // ── Search / filter ───────────────────────────────────────────────────────────
  const allTags = Array.from(new Set(topLevel.flatMap((p) => p.tags))).sort();
  const query = search.trim().toLowerCase();
  const filtersActive = query !== '' || filterDifficulty !== 'all' || filterTag != null;

  function matchesFilters(p: ProjectWithRelations): boolean {
    if (filterDifficulty !== 'all' && p.difficulty !== filterDifficulty) return false;
    if (filterTag != null && !p.tags.includes(filterTag)) return false;
    if (query) {
      const haystack = [p.title, p.description ?? '', ...p.tags].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }

  const visible = topLevel.filter(matchesFilters);
  const now = new Date();

  // ── Partitioned quest lists ───────────────────────────────────────────────────
  // Upcoming quests (availableAt in the future) are held out of the active board
  // and shown in their own section, sorted by when they activate.
  const notCompleted = visible.filter((p) => getQuestStatus(p, projects) !== 'completed');
  const upcomingProjects = notCompleted
    .filter((p) => isUpcoming(p.availableAt, now))
    .sort((a, b) => new Date(a.availableAt!).getTime() - new Date(b.availableAt!).getTime());
  // Active quests follow the user's manual board order (see reorderProjects).
  const activeProjects = notCompleted
    .filter((p) => !isUpcoming(p.availableAt, now))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  // Split the active board into cadence containers (Daily / Weekly / Other), each
  // preserving the manual sortOrder above. Reordering happens within a container.
  const activeByCat: Record<QuestCategory, ProjectWithRelations[]> = {
    daily: [],
    weekly: [],
    other: [],
  };
  for (const p of activeProjects) activeByCat[questCategory(p)].push(p);
  const completedProjects = visible
    .filter((p) => getQuestStatus(p, projects) === 'completed')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function resetForm() {
    setTitle('');
    setDescription('');
    setObjectives(['']);
    setSequentialObjectives(false);
    setItems([]);
    setIcon(null);
    setDifficulty(Difficulty.NORMAL);
    setTags([]);
    setTagDraft('');
    setAvailability('now');
    setAvailableDate('');
    setDeadline('');
    setError(null);
    setShowForm(false);
    setSelectedMemberIds([]);
    setMembersCanEdit(true);
    setPartyMode('coop');
    setGiveToId('');
    setIsEpic(false);
    setSequential(false);
    setSubQuests(['']);
    setRecurrenceType(RecurrenceType.NONE);
    setDayOfWeek(1);
    setIntervalWeeks(2);
    setIntervalDays(2);
    setDaysOfWeek([]);
    setDayOfMonth(1);
    setSpecificDate('');
    setResetHour(null);
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
            difficulty,
            tags,
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

    if (recurrenceType === RecurrenceType.DAYS_OF_WEEK && daysOfWeek.length === 0) {
      setError('Pick at least one day of the week for the recurrence');
      return;
    }

    const recurrencePayload = buildRecurrencePayload();

    // Giving hands the quest to one ally to do (solo, no co-op members); a plain
    // co-op share passes the selected member ids instead.
    const giving = partyMode === 'give' && !!giveToId;

    startTransition(async () => {
      try {
        const created = await createProject({
          title: trimmedTitle,
          description: description.trim() || undefined,
          objectives: trimmedObjectives,
          sequentialObjectives,
          inventoryItems: items.map((i) => i.trim()).filter(Boolean),
          icon: icon ?? undefined,
          difficulty,
          tags,
          availableAt: buildAvailableAtISO(),
          deadline: buildDeadlineISO(),
          memberIds: partyMode === 'give' ? [] : selectedMemberIds,
          membersCanEdit,
          ...recurrencePayload,
        });
        if (giving) {
          const res = await giveQuest({ projectId: created.id, userId: giveToId });
          if (!res.ok) {
            // The quest was created; only the hand-off failed. Surface why.
            setError(res.error);
            router.refresh();
            return;
          }
        }
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

  function handleRespondInvite(projectId: string, accept: boolean) {
    startRespond(async () => {
      const res = await respondToQuestInvite({ projectId, accept });
      // On accept the quest joins the board; either way the invite leaves the list.
      // A refresh re-fetches both from the server.
      if (res.ok) router.refresh();
    });
  }

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleRecurrenceDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  function commitTag() {
    const t = tagDraft.trim();
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTagDraft('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
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

  /** ISO timestamp for when the quest should enter the active log (or undefined = now). */
  function buildAvailableAtISO(): string | undefined {
    if (availability === 'now') return undefined;
    if (availability === 'date') {
      return availableDate ? new Date(`${availableDate}T00:00:00`).toISOString() : undefined;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (availability === '1d') d.setDate(d.getDate() + 1);
    else if (availability === '1w') d.setDate(d.getDate() + 7);
    else if (availability === '2w') d.setDate(d.getDate() + 14);
    else if (availability === '1m') d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }

  function buildDeadlineISO(): string | undefined {
    return deadline ? new Date(`${deadline}T23:59:59`).toISOString() : undefined;
  }

  function buildRecurrencePayload() {
    switch (recurrenceType) {
      case RecurrenceType.NONE:
        return { recurrenceType: RecurrenceType.NONE };
      case RecurrenceType.DAILY:
        return { recurrenceType: RecurrenceType.DAILY, resetHour };
      case RecurrenceType.WEEKLY:
        return { recurrenceType: RecurrenceType.WEEKLY, dayOfWeek, resetHour };
      case RecurrenceType.EVERY_N_WEEKS:
        return { recurrenceType: RecurrenceType.EVERY_N_WEEKS, dayOfWeek, intervalWeeks, resetHour };
      case RecurrenceType.EVERY_N_DAYS:
        return { recurrenceType: RecurrenceType.EVERY_N_DAYS, intervalDays, resetHour };
      case RecurrenceType.DAYS_OF_WEEK:
        return { recurrenceType: RecurrenceType.DAYS_OF_WEEK, daysOfWeek, resetHour };
      case RecurrenceType.MONTHLY:
        return { recurrenceType: RecurrenceType.MONTHLY, dayOfMonth, resetHour };
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

  // Skip a missed recurring quest: drop the overdue cycle (no XP) and resume the
  // schedule at the current occurrence. A refresh re-runs syncRecurringQuests.
  function handleDismissMissed(projectId: string) {
    startTransition(async () => {
      try {
        await dismissMissedQuest({ projectId });
        router.refresh();
      } catch {
        /* best-effort; a refresh will resync the board */
      }
    });
  }

  // Manual board reordering: persist a new active-quest order (used by both the
  // ↑/↓ arrows and drag-and-drop). Disabled while filters are narrowing the board.
  function persistActiveOrder(next: ProjectWithRelations[]) {
    const orderedIds = next.map((p) => p.id);
    startReorder(async () => {
      try {
        await reorderProjects({ orderedIds });
        router.refresh();
      } catch {
        /* best-effort reorder; refresh will resync on next load */
      }
    });
  }

  // Reorder happens within a single cadence container. We splice the container's
  // new order back into the full active list (Daily, then Weekly, then Other) and
  // persist that — cross-container order is irrelevant to display.
  function persistGroupedOrder(category: QuestCategory, nextGroup: ProjectWithRelations[]) {
    const merged = (['daily', 'weekly', 'other'] as QuestCategory[]).flatMap((cat) =>
      cat === category ? nextGroup : activeByCat[cat],
    );
    persistActiveOrder(merged);
  }

  function moveActiveQuest(category: QuestCategory, index: number, direction: 'up' | 'down') {
    const group = activeByCat[category];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const next = [...group];
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    persistGroupedOrder(category, next);
  }

  // Drag-and-drop: touch-friendly reordering via a grip handle on each card.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(category: QuestCategory, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const group = activeByCat[category];
    const oldIndex = group.findIndex((p) => p.id === active.id);
    const newIndex = group.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persistGroupedOrder(category, arrayMove(group, oldIndex, newIndex));
  }

  function renderQuestCard(
    project: ProjectWithRelations,
    index = 0,
    upcoming = false,
    reorderable = false,
    listLength = 0,
    sortable?: SortableBag,
  ) {
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
      now,
    );
    const label = recurrenceLabel({
      ...project,
      dueDate: project.dueDate ? new Date(project.dueDate) : null,
      specificDate: project.specificDate ? new Date(project.specificDate) : null,
    });
    // Deadline countdown only matters once the quest is active (not upcoming).
    const countdown = upcoming
      ? null
      : deadlineCountdown(project.deadline, now, status === 'completed');
    const overdue = missed || countdown?.tone === 'overdue';

    const borderClass = overdue
      ? 'border-red-500/50 group-hover:border-red-400/70'
      : statusCardStyles[status];
    const diff = difficultyMeta(project.difficulty);

    return (
      <div
        key={project.id}
        ref={sortable?.setNodeRef}
        className={cn(
          'animate-card-enter relative group',
          upcoming && 'opacity-70',
          sortable?.isDragging && 'z-20 opacity-80',
        )}
        style={
          sortable ? sortable.style : { animationDelay: `${Math.min(index, 12) * 60}ms` }
        }
      >
        <Link
          href={`/projects/${project.id}`}
          className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Card className={cn('h-full transition-all duration-200 group-hover:shadow-glow group-hover:-translate-y-0.5', borderClass, status !== 'completed' && diff.cardAccent)}>
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
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', diff.badgeClass)}>
                    <span aria-hidden>{diff.emoji}</span>
                    {diff.label}
                  </span>
                  {project.isEpic && (
                    <span className="inline-flex items-center rounded-md bg-amber-950/40 border border-amber-500/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                      ⚔ Epic{project.sequential ? ' · in order' : ''}
                    </span>
                  )}
                  {(project.members?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/40 border border-emerald-500/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                      🧑‍🤝‍🧑 Party · {(project.members ?? []).filter((m) => m.status === 'ACCEPTED').length + 1}
                      {project.userId !== currentUserId && ' · shared with you'}
                    </span>
                  )}
                  {label && (
                    <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                      {label}
                    </span>
                  )}
                  {missed && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-red-950/50 border border-red-500/40 px-2 py-0.5 text-xs font-medium text-red-300">
                      ⚠ Missed
                      {project.recurrenceType !== RecurrenceType.NONE &&
                        project.recurrenceType !== RecurrenceType.SPECIFIC_DATE && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleDismissMissed(project.id);
                            }}
                            disabled={isPending}
                            title="Skip this missed day and keep the quest repeating"
                            aria-label={`Skip the missed "${project.title}" and keep it repeating`}
                            className="rounded bg-red-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                          >
                            Skip
                          </button>
                        )}
                    </span>
                  )}
                  {upcoming && project.availableAt && (
                    <span className="inline-flex items-center rounded-md bg-zinc-800 border border-zinc-600/50 px-2 py-0.5 text-xs font-medium text-zinc-300">
                      ◷ Activates {formatActivatesIn(project.availableAt, now)}
                    </span>
                  )}
                  {countdown && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border',
                        countdown.tone === 'overdue'
                          ? 'bg-red-950/50 border-red-500/40 text-red-300'
                          : countdown.tone === 'soon'
                            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-800 border-zinc-600/50 text-zinc-300',
                      )}
                    >
                      ⏳ {countdown.label}
                    </span>
                  )}
                  {project.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-md bg-indigo-950/30 border border-indigo-500/30 px-2 py-0.5 text-xs font-medium text-indigo-300"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
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
        {project.userId === currentUserId && (
          <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity z-10">
            {reorderable && sortable && (
              <button
                type="button"
                ref={sortable.setActivatorNodeRef}
                {...sortable.attributes}
                {...sortable.listeners}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                aria-label={`Drag "${project.title}" to reorder`}
                className="cursor-grab active:cursor-grabbing touch-none text-zinc-500 hover:text-indigo-400 transition-colors text-sm px-1"
              >
                ⠿
              </button>
            )}
            {reorderable && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    moveActiveQuest(questCategory(project), index, 'up');
                  }}
                  disabled={index === 0 || isReordering}
                  aria-label={`Move "${project.title}" earlier`}
                  className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors text-sm px-1"
                >
                  ↑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    moveActiveQuest(questCategory(project), index, 'down');
                  }}
                  disabled={index === listLength - 1 || isReordering}
                  aria-label={`Move "${project.title}" later`}
                  className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors text-sm px-1"
                >
                  ↓
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void handleDeleteProject(project.id, project.title);
              }}
              aria-label={`Delete "${project.title}"`}
              className="text-zinc-500 hover:text-red-400 text-sm px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-6">
        <ProgressionHeader />
      </div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
            Your Quests
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track your objectives and loot, one quest at a time.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>+ New Quest</Button>
          )}
          <Link
            href="/today"
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all"
          >
            ☀ Today
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all"
          >
            🗓 Calendar
          </Link>
          <Link
            href="/insights"
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all"
          >
            📊 Insights
          </Link>
          <Link
            href="/achievements"
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all"
          >
            🏆 Achievements
          </Link>
          <ShopNavLink variant="pill" />
          <NotificationBell variant="pill" />
          <Link
            href="/party"
            className="relative inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all"
          >
            🧑‍🤝‍🧑 Party
            {pendingNoticeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center rounded-full bg-indigo-500 text-white text-xs font-semibold h-5 min-w-5 px-1 ring-2 ring-zinc-950">
                {pendingNoticeCount}
              </span>
            )}
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

              {/* Difficulty (scales XP reward & card rarity) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Difficulty <span className="text-zinc-500">(more XP for harder quests)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDifficulty(d.value)}
                      aria-pressed={difficulty === d.value}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                        difficulty === d.value
                          ? 'border-amber-500/60 bg-amber-950/40 text-amber-200'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      <span aria-hidden>{d.emoji}</span>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label htmlFor="quest-tag" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Tags <span className="text-zinc-500">(optional — for grouping & filtering)</span>
                </label>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-950/40 border border-indigo-500/40 px-2 py-0.5 text-xs font-medium text-indigo-200"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          aria-label={`Remove tag ${t}`}
                          className="text-indigo-400 hover:text-indigo-200"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  id="quest-tag"
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      commitTag();
                    }
                  }}
                  onBlur={commitTag}
                  className="field"
                  placeholder="Type a tag and press Enter"
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
                <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sequentialObjectives}
                    onChange={(e) => setSequentialObjectives(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="text-sm text-zinc-200">
                    Must be done in order
                    <span className="text-zinc-500"> — later objectives stay locked 🔒 until earlier ones are complete</span>
                  </span>
                </label>
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

              {/* Party (accepted allies only): share co-op, or give to one ally to do */}
              {allies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Party <span className="text-zinc-500">(optional)</span>
                  </label>
                  <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-800/50 p-0.5 mb-3">
                    {([
                      ['coop', '🧑‍🤝‍🧑 Share (co-op)'],
                      ['give', '🎁 Give to an ally'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPartyMode(mode)}
                        aria-pressed={partyMode === mode}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                          partyMode === mode
                            ? 'bg-emerald-950/60 text-emerald-200'
                            : 'text-zinc-400 hover:text-zinc-200',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {partyMode === 'coop' ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {allies.map((a) => {
                          const selected = selectedMemberIds.includes(a.userId);
                          const label = a.username ? `@${a.username}` : a.name ?? 'ally';
                          return (
                            <button
                              key={a.userId}
                              type="button"
                              onClick={() => toggleMember(a.userId)}
                              aria-pressed={selected}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                                selected
                                  ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
                              )}
                            >
                              {selected && <span aria-hidden>✓</span>}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-xs text-zinc-500">
                        Invited allies must accept on their <span className="text-zinc-400">Party</span> page before the quest appears on their board.
                      </p>

                      {selectedMemberIds.length > 0 && (
                        <label className="mt-3 flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={membersCanEdit}
                            onChange={(e) => setMembersCanEdit(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/40"
                          />
                          <span className="text-sm text-zinc-300">
                            Let party members edit this quest
                            <span className="block text-xs text-zinc-500">
                              Members can add and edit objectives, inventory, and settings. They can always check off progress; only you can delete the quest.
                            </span>
                          </span>
                        </label>
                      )}
                    </>
                  ) : (
                    <>
                      <select
                        value={giveToId}
                        onChange={(e) => setGiveToId(e.target.value)}
                        className="field"
                        aria-label="Choose an ally to give this quest to"
                      >
                        <option value="">Choose an ally…</option>
                        {allies.map((a) => (
                          <option key={a.userId} value={a.userId}>
                            {a.username ? `@${a.username}` : a.name ?? 'ally'}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-zinc-500">
                        They&apos;ll do this quest (checking objectives off) but can&apos;t edit it — you keep editing and watch their progress. Rewards split: they earn full XP, you earn half. They accept on their <span className="text-zinc-400">Party</span> page.
                      </p>
                    </>
                  )}
                </div>
              )}
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
              {/* Show up in active log */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Show up in my active log
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAvailability(opt.value)}
                      aria-pressed={availability === opt.value}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                        availability === opt.value
                          ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-200'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {availability === 'date' && (
                  <input
                    type="date"
                    value={availableDate}
                    onChange={(e) => setAvailableDate(e.target.value)}
                    className="field mt-2"
                    aria-label="Date the quest becomes active"
                  />
                )}
                <p className="mt-1.5 text-xs text-zinc-500">
                  Future quests wait in your <span className="text-zinc-400">Upcoming</span> list until then.
                </p>
              </div>

              {/* Finish-by deadline */}
              <div>
                <label htmlFor="quest-deadline" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Finish by <span className="text-zinc-500">(optional — shows a countdown)</span>
                </label>
                <input
                  id="quest-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="field"
                />
              </div>

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
                  <option value={RecurrenceType.EVERY_N_DAYS}>Every N days</option>
                  <option value={RecurrenceType.WEEKLY}>Weekly</option>
                  <option value={RecurrenceType.DAYS_OF_WEEK}>Days of week</option>
                  <option value={RecurrenceType.EVERY_N_WEEKS}>Every N weeks</option>
                  <option value={RecurrenceType.MONTHLY}>Monthly</option>
                  <option value={RecurrenceType.SPECIFIC_DATE}>Specific date</option>
                </select>
              </div>

              {recurrenceType !== RecurrenceType.NONE &&
                recurrenceType !== RecurrenceType.SPECIFIC_DATE && (
                <div>
                  <label
                    htmlFor="quest-reset-hour"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    Reset time <span className="text-zinc-500">(when it rolls over)</span>
                  </label>
                  <select
                    id="quest-reset-hour"
                    value={resetHour ?? ''}
                    onChange={(e) =>
                      setResetHour(e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="field"
                  >
                    <option value="">Use my default (Settings)</option>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {recurrenceType === RecurrenceType.EVERY_N_DAYS && (
                <div>
                  <label
                    htmlFor="quest-interval-days"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    Every N days
                  </label>
                  <input
                    id="quest-interval-days"
                    type="number"
                    min={1}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value)))}
                    className="field"
                  />
                </div>
              )}

              {recurrenceType === RecurrenceType.DAYS_OF_WEEK && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Days of week <span className="text-zinc-500">(pick one or more)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((opt) => {
                      const selected = daysOfWeek.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleRecurrenceDay(opt.value)}
                          aria-pressed={selected}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                            selected
                              ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-200'
                              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
                          )}
                        >
                          {opt.label.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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

      {/* Pending quests to accept/decline — co-op invites and given quests */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
          <h2 className="mb-3 flex items-center text-sm font-semibold text-amber-200">
            Quests awaiting your response
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-xs font-semibold h-5 min-w-5 px-1.5">
              {pendingInvites.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {pendingInvites.map((inv) => {
              const hero = inv.inviterUsername
                ? `@${inv.inviterUsername}`
                : inv.inviterName ?? 'an ally';
              return (
                <li
                  key={inv.projectId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {inv.icon && (
                      <img src={inv.icon} alt="" loading="lazy" className="h-7 w-7 object-contain flex-shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-100 truncate">
                        {inv.isGiven && '🎁 '}
                        {inv.title}
                      </span>
                      <span className="block text-xs text-zinc-500 truncate">
                        {inv.isGiven ? `${hero} gave you this quest to do` : `from ${hero}`}
                      </span>
                    </span>
                  </span>
                  <span className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleRespondInvite(inv.projectId, true)}
                      disabled={isResponding}
                    >
                      {inv.isGiven ? 'Accept' : 'Join'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRespondInvite(inv.projectId, false)}
                      disabled={isResponding}
                    >
                      Decline
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Search & filters */}
      {topLevel.length > 0 && (
        <div className="mb-6 space-y-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quests by title, description, or tag…"
            className="field"
            aria-label="Search quests"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Difficulty:</span>
            <button
              type="button"
              onClick={() => setFilterDifficulty('all')}
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs font-medium transition-all',
                filterDifficulty === 'all'
                  ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-200'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
              )}
            >
              All
            </button>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setFilterDifficulty(d.value)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-all',
                  filterDifficulty === d.value
                    ? 'border-amber-500/60 bg-amber-950/40 text-amber-200'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
                )}
              >
                <span aria-hidden>{d.emoji}</span>
                {d.label}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Tags:</span>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTag((cur) => (cur === t ? null : t))}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs font-medium transition-all',
                    filterTag === t
                      ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-200'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-16 text-center text-zinc-500">
          No quests yet — create one to begin your adventure.
        </div>
      ) : visible.length === 0 && filtersActive ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-16 text-center text-zinc-500">
          No quests match your filters.
        </div>
      ) : (
        <>
          {/* Active quests section — split into cadence containers */}
          {activeProjects.length === 0 && completedProjects.length > 0 ? (
            <p className="text-sm text-zinc-500">No active quests.</p>
          ) : (
            <div className="space-y-6">
              {CATEGORY_META.map(({ key, label, border, accent }) => {
                const group = activeByCat[key];
                if (group.length === 0) return null;
                return (
                  <section
                    key={key}
                    className={cn('rounded-xl border bg-zinc-900/40 p-4', border)}
                  >
                    <h2
                      className={cn(
                        'text-sm font-semibold uppercase tracking-wide mb-4',
                        accent,
                      )}
                    >
                      {label} · {group.length}
                    </h2>
                    {filtersActive ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {group.map((project, i) =>
                          renderQuestCard(project, i, false, false, group.length),
                        )}
                      </div>
                    ) : (
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(key, event)}
                      >
                        <SortableContext
                          items={group.map((p) => p.id)}
                          strategy={rectSortingStrategy}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {group.map((project, i) => (
                              <SortableQuestCard key={project.id} id={project.id}>
                                {(bag) =>
                                  renderQuestCard(project, i, false, true, group.length, bag)
                                }
                              </SortableQuestCard>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {/* Upcoming quests section */}
          {upcomingProjects.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowUpcoming((prev) => !prev)}
                aria-expanded={showUpcoming}
                className="w-full flex items-center gap-3 mt-10 mb-5 text-left group"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={cn(
                    'w-4 h-4 text-indigo-400/80 flex-shrink-0 transition-transform duration-200',
                    showUpcoming ? 'rotate-90' : 'rotate-0',
                  )}
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-indigo-400/80 whitespace-nowrap">
                  ◷ Upcoming · {upcomingProjects.length}
                </span>
                <span className="flex-1 h-px bg-zinc-800" />
              </button>

              {showUpcoming && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {upcomingProjects.map((project, i) => renderQuestCard(project, i, true))}
                </div>
              )}
            </>
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
