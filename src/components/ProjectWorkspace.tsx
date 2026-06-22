'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecurrenceType, Difficulty } from '@prisma/client';
import { useProjectStore } from '@/store/useProjectStore';
import {
  toggleObjective,
  toggleInventoryItem,
  createObjective,
  createInventoryItem,
  updateProject,
  updateProjectIcon,
  updateObjective,
  deleteObjective,
  renameInventoryItem,
  deleteInventoryItem,
  createSubQuest,
  reorderSubQuest,
  reorderObjective,
  reorderInventoryItem,
  setSequentialObjectives,
  updateEpicSettings,
  setDifficulty,
  setTags,
  setQuestTiming,
  setMemberPermissions,
  deleteProject,
} from '@/app/actions/projects';
import type { ProjectWithRelations } from '@/app/actions/projects';
import { recurrenceLabel, isMissed } from '@/lib/recurrence';
import { deadlineCountdown, isUpcoming, formatActivatesIn } from '@/lib/timing';
import {
  getChildren,
  questProgress,
  getQuestStatus,
  lockedSubQuestIds,
  isSubQuestLocked,
  lockedObjectiveIds,
} from '@/lib/quest';
import { difficultyMeta, DIFFICULTIES } from '@/lib/difficulty';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import IconPicker from '@/components/IconPicker';
import LogoutButton from '@/components/LogoutButton';
import ProgressionHeader from '@/components/ProgressionHeader';
import { SparkleBurst, QuestCompleteEffect } from '@/components/QuestEffects';

interface Props {
  initialProjects: ProjectWithRelations[];
  projectId: string;
  currentUserId: string;
}

const WEEKDAY_OPTIONS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

/** Format a Date (or date-like string) to 'YYYY-MM-DD' for <input type="date">. */
function toDateInputValue(d: Date | string | null): string {
  if (!d) return '';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ProjectWorkspace({ initialProjects, projectId, currentUserId }: Props) {
  const router = useRouter();
  const hydrate = useProjectStore((s) => s.hydrate);
  const storeProjects = useProjectStore((s) => s.projects);
  const optimisticToggle = useProjectStore((s) => s.optimisticToggleObjective);
  const rollbackObjective = useProjectStore((s) => s.rollbackObjective);
  const optimisticToggleItem = useProjectStore((s) => s.optimisticToggleInventoryItem);
  const rollbackInventoryItem = useProjectStore((s) => s.rollbackInventoryItem);
  const optimisticUpdateProj = useProjectStore((s) => s.optimisticUpdateProject);
  const rollbackProj = useProjectStore((s) => s.rollbackProject);
  const optimisticRenameObj = useProjectStore((s) => s.optimisticRenameObjective);
  const rollbackRenameObj = useProjectStore((s) => s.rollbackRenameObjective);
  const optimisticDelObj = useProjectStore((s) => s.optimisticDeleteObjective);
  const rollbackDelObj = useProjectStore((s) => s.rollbackDeleteObjective);
  const optimisticRenameItem = useProjectStore((s) => s.optimisticRenameInventoryItem);
  const rollbackRenameItem = useProjectStore((s) => s.rollbackRenameInventoryItem);
  const optimisticDelItem = useProjectStore((s) => s.optimisticDeleteInventoryItem);
  const rollbackDelItem = useProjectStore((s) => s.rollbackDeleteInventoryItem);
  const optimisticDeleteProj = useProjectStore((s) => s.optimisticDeleteProject);
  const rollbackDeleteProj = useProjectStore((s) => s.rollbackDeleteProject);

  // ── Add forms ─────────────────────────────────────────────────────────────────
  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjError, setNewObjError] = useState<string | null>(null);
  const [isAddingObj, startAddObj] = useTransition();

  const [newItemName, setNewItemName] = useState('');
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [isAddingItem, startAddItem] = useTransition();

  // ── Quest title inline edit ───────────────────────────────────────────────────
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSavingTitle, startSaveTitle] = useTransition();

  // ── Objective inline edit ─────────────────────────────────────────────────────
  const [editingObjId, setEditingObjId] = useState<string | null>(null);
  const [objDraft, setObjDraft] = useState('');
  const [objEditError, setObjEditError] = useState<string | null>(null);
  const [isSavingObj, startSaveObj] = useTransition();

  // ── Inventory item inline edit ────────────────────────────────────────────────
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemDraft, setEditItemDraft] = useState('');
  const [editItemError, setEditItemError] = useState<string | null>(null);
  const [isSavingItemName, startSaveItemName] = useTransition();

  // ── Schedule editor state (initialised after project is known) ────────────────
  const [schedRecurrenceType, setSchedRecurrenceType] = useState<RecurrenceType>(RecurrenceType.NONE);
  const [schedDayOfWeek, setSchedDayOfWeek] = useState<number>(1);
  const [schedIntervalWeeks, setSchedIntervalWeeks] = useState<number>(2);
  const [schedDayOfMonth, setSchedDayOfMonth] = useState<number>(1);
  const [schedSpecificDate, setSchedSpecificDate] = useState<string>('');
  const [schedError, setSchedError] = useState<string | null>(null);
  const [isSavingSched, startSaveSched] = useTransition();
  const [schedInitialised, setSchedInitialised] = useState(false);

  // ── Icon editor state ─────────────────────────────────────────────────────────
  const [iconError, setIconError] = useState<string | null>(null);
  const [isSavingIcon, startSaveIcon] = useTransition();

  // ── Completion reward effects ──────────────────────────────────────────────────
  // `celebrate` drives the per-objective sparkle/glow; `questDone` the full-quest
  // celebration. Both carry a nonce so remounting restarts the CSS animation.
  const [celebrate, setCelebrate] = useState<{ objId: string; nonce: number } | null>(null);
  const [questDone, setQuestDone] = useState<number | null>(null);
  // Bumped after any XP-affecting toggle so the ProgressionHeader re-fetches.
  const [progressionNonce, setProgressionNonce] = useState(0);
  const [isSavingDifficulty, startSaveDifficulty] = useTransition();
  const [tagDraft, setTagDraft] = useState('');
  const [isSavingTags, startSaveTags] = useTransition();
  const [isSavingTiming, startSaveTiming] = useTransition();
  const [isSavingPerms, startSavePerms] = useTransition();
  const [isMutatingObj, startMutateObj] = useTransition();
  const [isMutatingItem, startMutateItem] = useTransition();
  const [isSavingSeqObj, startSaveSeqObj] = useTransition();

  // ── Sub-quest (epic) management state ───────────────────────────────────────────
  const [newSubQuestTitle, setNewSubQuestTitle] = useState('');
  const [subQuestError, setSubQuestError] = useState<string | null>(null);
  const [isAddingSubQuest, startAddSubQuest] = useTransition();
  const [isMutatingEpic, startMutateEpic] = useTransition();

  useEffect(() => {
    hydrate(initialProjects);
  }, [hydrate, initialProjects]);

  const allProjects = storeProjects.length > 0 ? storeProjects : initialProjects;
  const project = allProjects.find((p) => p.id === projectId);

  // Initialise schedule editor once project is available
  useEffect(() => {
    if (!project || schedInitialised) return;
    setSchedRecurrenceType(project.recurrenceType);
    setSchedDayOfWeek(project.dayOfWeek ?? 1);
    setSchedIntervalWeeks(project.intervalWeeks ?? 2);
    setSchedDayOfMonth(project.dayOfMonth ?? 1);
    setSchedSpecificDate(toDateInputValue(project.specificDate));
    setSchedInitialised(true);
  }, [project, schedInitialised]);

  if (!project) return null;

  // ── Sharing & permissions ───────────────────────────────────────────────────────
  // The workspace only ever shows quests the viewer owns or has accepted, so a
  // non-owner here is always an accepted member.
  const isOwner = project.userId === currentUserId;
  const acceptedMembers = (project.members ?? []).filter((m) => m.status === 'ACCEPTED');
  const isSharedQuest = (project.members ?? []).length > 0;
  // Owner always; members only when the owner allows it. Checking progress off is
  // always allowed (handled separately) — this gates structural edits & settings.
  const canEdit = isOwner || project.membersCanEdit;

  // ── Hierarchy: epic / sub-quest / standalone ────────────────────────────────────
  const isEpic = project.isEpic;
  const isSubQuest = project.parentId != null;
  const parent = isSubQuest
    ? allProjects.find((p) => p.id === project.parentId)
    : undefined;
  const locked = isSubQuest ? isSubQuestLocked(project, allProjects) : false;
  const children = isEpic ? getChildren(project, allProjects) : [];
  const lockedIds = isEpic ? lockedSubQuestIds(project, allProjects) : new Set<string>();
  // Objectives locked behind earlier ones when this quest enforces in-order completion.
  const objLocked = lockedObjectiveIds(project);

  const { done, total } = questProgress(project, allProjects);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const progressUnit = isEpic ? 'sub-quest' : 'objective';

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

  const timingNow = new Date();
  const questComplete = total > 0 && done === total;
  const upcoming = isUpcoming(project.availableAt, timingNow);
  const countdown = upcoming
    ? null
    : deadlineCountdown(project.deadline, timingNow, questComplete);

  // ── Handlers: toggle objective + gather item ──────────────────────────────────

  async function handleToggle(objectiveId: string) {
    if (locked) return; // sub-quest locked behind earlier siblings
    if (objLocked.has(objectiveId)) return; // out-of-order under sequential objectives
    const prev = optimisticToggle(objectiveId);

    // Only celebrate when an objective transitions into completion.
    if (!prev) {
      setCelebrate({ objId: objectiveId, nonce: Date.now() });
      window.setTimeout(() => {
        setCelebrate((c) => (c?.objId === objectiveId ? null : c));
      }, 900);

      // If this check completed the whole quest, fire the big celebration.
      const fresh = useProjectStore.getState().projects.find((p) => p.id === projectId);
      const allDone =
        fresh != null &&
        fresh.objectives.length > 0 &&
        fresh.objectives.every((o) => o.isCompleted);
      if (allDone) {
        const nonce = Date.now();
        setQuestDone(nonce);
        window.setTimeout(() => {
          setQuestDone((q) => (q === nonce ? null : q));
        }, 3000);
      }
    }

    try {
      await toggleObjective({ objectiveId });
      setProgressionNonce((n) => n + 1); // XP changed — refresh the header
    } catch {
      rollbackObjective(objectiveId, prev);
    }
  }

  async function handleToggleItem(itemId: string) {
    const prev = optimisticToggleItem(itemId);
    try {
      await toggleInventoryItem({ itemId });
      setProgressionNonce((n) => n + 1); // XP changed — refresh the header
    } catch {
      rollbackInventoryItem(itemId, prev);
    }
  }

  function handleSetDifficulty(next: Difficulty) {
    if (next === project?.difficulty) return;
    startSaveDifficulty(async () => {
      try {
        await setDifficulty({ projectId, difficulty: next });
        router.refresh();
      } catch {
        /* best-effort; refresh will resync */
      }
    });
  }

  function persistTags(nextTags: string[]) {
    startSaveTags(async () => {
      try {
        await setTags({ projectId, tags: nextTags });
        router.refresh();
      } catch {
        /* best-effort; refresh will resync */
      }
    });
  }

  function handleAddTag() {
    const t = tagDraft.trim();
    if (!t || !project) return;
    if (project.tags.includes(t)) {
      setTagDraft('');
      return;
    }
    persistTags([...project.tags, t]);
    setTagDraft('');
  }

  function handleRemoveTag(tag: string) {
    if (!project) return;
    persistTags(project.tags.filter((t) => t !== tag));
  }

  function handleToggleMemberPerms(next: boolean) {
    startSavePerms(async () => {
      try {
        await setMemberPermissions({ projectId, membersCanEdit: next });
        router.refresh();
      } catch {
        /* best-effort; refresh will resync */
      }
    });
  }

  function handleSetTiming(nextAvailableDate: string, nextDeadlineDate: string) {
    startSaveTiming(async () => {
      try {
        await setQuestTiming({
          projectId,
          availableAt: nextAvailableDate
            ? new Date(`${nextAvailableDate}T00:00:00`).toISOString()
            : null,
          deadline: nextDeadlineDate
            ? new Date(`${nextDeadlineDate}T23:59:59`).toISOString()
            : null,
        });
        router.refresh();
      } catch {
        /* best-effort; refresh will resync */
      }
    });
  }

  // ── Handlers: add forms ───────────────────────────────────────────────────────

  function handleAddObjective(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNewObjError(null);
    const title = newObjTitle.trim();
    if (!title) { setNewObjError('Title is required'); return; }
    startAddObj(async () => {
      try {
        await createObjective({ projectId, title });
        setNewObjTitle('');
        router.refresh();
      } catch (err) {
        setNewObjError(err instanceof Error ? err.message : 'Failed to add objective');
      }
    });
  }

  function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNewItemError(null);
    const name = newItemName.trim();
    if (!name) { setNewItemError('Name is required'); return; }
    startAddItem(async () => {
      try {
        await createInventoryItem({ projectId, name });
        setNewItemName('');
        router.refresh();
      } catch (err) {
        setNewItemError(err instanceof Error ? err.message : 'Failed to add item');
      }
    });
  }

  // ── Handlers: quest title ─────────────────────────────────────────────────────

  function beginEditTitle() {
    if (!project) return;
    setTitleDraft(project.title);
    setTitleError(null);
    setEditingTitle(true);
  }

  function cancelEditTitle() {
    setEditingTitle(false);
    setTitleError(null);
  }

  function handleSaveTitle() {
    const title = titleDraft.trim();
    if (!title) { setTitleError('Title cannot be empty'); return; }
    const prev = optimisticUpdateProj(projectId, title);
    setEditingTitle(false);
    startSaveTitle(async () => {
      try {
        await updateProject({ projectId, title });
        router.refresh();
      } catch (err) {
        rollbackProj(projectId, prev);
        setTitleError(err instanceof Error ? err.message : 'Failed to rename quest');
        setEditingTitle(true);
        setTitleDraft(title);
      }
    });
  }

  // ── Handlers: objectives ──────────────────────────────────────────────────────

  function beginEditObj(id: string, currentTitle: string) {
    setEditingObjId(id);
    setObjDraft(currentTitle);
    setObjEditError(null);
  }

  function cancelEditObj() {
    setEditingObjId(null);
    setObjEditError(null);
  }

  function handleSaveObj(objectiveId: string) {
    const title = objDraft.trim();
    if (!title) { setObjEditError('Title cannot be empty'); return; }
    const prev = optimisticRenameObj(objectiveId, title);
    setEditingObjId(null);
    startSaveObj(async () => {
      try {
        await updateObjective({ objectiveId, title });
      } catch (err) {
        rollbackRenameObj(objectiveId, prev);
        setObjEditError(err instanceof Error ? err.message : 'Failed to rename objective');
        setEditingObjId(objectiveId);
        setObjDraft(title);
      }
    });
  }

  async function handleDeleteObj(objectiveId: string) {
    const saved = optimisticDelObj(objectiveId);
    try {
      await deleteObjective({ objectiveId });
    } catch {
      if (saved) rollbackDelObj(saved);
    }
  }

  // ── Handlers: inventory items ─────────────────────────────────────────────────

  function beginEditItem(id: string, currentName: string) {
    setEditingItemId(id);
    setEditItemDraft(currentName);
    setEditItemError(null);
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditItemError(null);
  }

  function handleSaveItemName(itemId: string) {
    const name = editItemDraft.trim();
    if (!name) { setEditItemError('Name cannot be empty'); return; }
    const prev = optimisticRenameItem(itemId, name);
    setEditingItemId(null);
    startSaveItemName(async () => {
      try {
        await renameInventoryItem({ itemId, name });
      } catch (err) {
        rollbackRenameItem(itemId, prev);
        setEditItemError(err instanceof Error ? err.message : 'Failed to rename item');
        setEditingItemId(itemId);
        setEditItemDraft(name);
      }
    });
  }

  async function handleDeleteItem(itemId: string) {
    const saved = optimisticDelItem(itemId);
    try {
      await deleteInventoryItem({ itemId });
    } catch {
      if (saved) rollbackDelItem(saved);
    }
  }

  // ── Handler: save schedule ────────────────────────────────────────────────────

  function handleSaveSchedule() {
    if (!project) return;
    setSchedError(null);

    if (schedRecurrenceType === RecurrenceType.SPECIFIC_DATE && !schedSpecificDate) {
      setSchedError('Please choose a specific date');
      return;
    }

    let recurrencePayload: Record<string, unknown>;
    switch (schedRecurrenceType) {
      case RecurrenceType.NONE:
        recurrencePayload = { recurrenceType: RecurrenceType.NONE };
        break;
      case RecurrenceType.DAILY:
        recurrencePayload = { recurrenceType: RecurrenceType.DAILY };
        break;
      case RecurrenceType.WEEKLY:
        recurrencePayload = { recurrenceType: RecurrenceType.WEEKLY, dayOfWeek: schedDayOfWeek };
        break;
      case RecurrenceType.EVERY_N_WEEKS:
        recurrencePayload = {
          recurrenceType: RecurrenceType.EVERY_N_WEEKS,
          dayOfWeek: schedDayOfWeek,
          intervalWeeks: schedIntervalWeeks,
        };
        break;
      case RecurrenceType.MONTHLY:
        recurrencePayload = { recurrenceType: RecurrenceType.MONTHLY, dayOfMonth: schedDayOfMonth };
        break;
      case RecurrenceType.SPECIFIC_DATE:
        recurrencePayload = {
          recurrenceType: RecurrenceType.SPECIFIC_DATE,
          specificDate: new Date(`${schedSpecificDate}T12:00:00`).toISOString(),
        };
        break;
    }

    const currentTitle = project.title;
    const currentDescription = project.description ?? undefined;

    startSaveSched(async () => {
      try {
        await updateProject({
          projectId,
          title: currentTitle,
          description: currentDescription,
          ...recurrencePayload,
        });
        router.refresh();
      } catch (err) {
        setSchedError(err instanceof Error ? err.message : 'Failed to save schedule');
      }
    });
  }

  // ── Handler: icon ─────────────────────────────────────────────────────────────

  function handleIconChange(next: string | null) {
    setIconError(null);
    startSaveIcon(async () => {
      try {
        await updateProjectIcon({ projectId, icon: next });
        router.refresh();
      } catch (err) {
        setIconError(err instanceof Error ? err.message : 'Failed to update icon');
      }
    });
  }

  // ── Handlers: epic / sub-quests ───────────────────────────────────────────────

  function handleAddSubQuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubQuestError(null);
    const title = newSubQuestTitle.trim();
    if (!title) { setSubQuestError('Title is required'); return; }
    startAddSubQuest(async () => {
      try {
        await createSubQuest({ epicId: projectId, title });
        setNewSubQuestTitle('');
        router.refresh();
      } catch (err) {
        setSubQuestError(err instanceof Error ? err.message : 'Failed to add sub-quest');
      }
    });
  }

  function handleReorderSubQuest(subQuestId: string, direction: 'up' | 'down') {
    startMutateEpic(async () => {
      try {
        await reorderSubQuest({ subQuestId, direction });
        router.refresh();
      } catch {
        /* best-effort reorder; refresh will resync on next load */
      }
    });
  }

  function handleToggleSequential(next: boolean) {
    startMutateEpic(async () => {
      try {
        await updateEpicSettings({ epicId: projectId, sequential: next });
        router.refresh();
      } catch (err) {
        setSubQuestError(err instanceof Error ? err.message : 'Failed to update setting');
      }
    });
  }

  function handleToggleSequentialObjectives(next: boolean) {
    startSaveSeqObj(async () => {
      try {
        await setSequentialObjectives({ projectId, sequential: next });
        router.refresh();
      } catch {
        /* best-effort; refresh will resync */
      }
    });
  }

  function handleReorderObjective(objectiveId: string, direction: 'up' | 'down') {
    startMutateObj(async () => {
      try {
        await reorderObjective({ objectiveId, direction });
        router.refresh();
      } catch {
        /* best-effort reorder; refresh will resync on next load */
      }
    });
  }

  function handleReorderItem(itemId: string, direction: 'up' | 'down') {
    startMutateItem(async () => {
      try {
        await reorderInventoryItem({ itemId, direction });
        router.refresh();
      } catch {
        /* best-effort reorder; refresh will resync on next load */
      }
    });
  }

  async function handleDeleteSubQuest(subQuestId: string, subTitle: string) {
    if (!window.confirm(`Delete sub-quest "${subTitle}"? This cannot be undone.`)) return;
    const saved = optimisticDeleteProj(subQuestId);
    try {
      await deleteProject({ projectId: subQuestId });
      router.refresh();
    } catch {
      if (saved) rollbackDeleteProj(saved);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <ProgressionHeader refreshSignal={progressionNonce} />
      {/* Header */}
      <div className="relative">
        {questDone != null && <QuestCompleteEffect key={questDone} />}
        <div className="flex items-center justify-between mb-5">
          {parent ? (
            <Link
              href={`/projects/${parent.id}`}
              className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
            >
              <span aria-hidden>←</span> {parent.title}
            </Link>
          ) : (
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
            >
              <span aria-hidden>←</span> Dashboard
            </Link>
          )}
          <LogoutButton />
        </div>

        {editingTitle ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') cancelEditTitle();
              }}
              className="field flex-1 text-xl font-bold"
            />
            <Button
              size="sm"
              onClick={handleSaveTitle}
              disabled={isSavingTitle || !titleDraft.trim()}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEditTitle}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 group mt-1">
            <h1
              className={cn(
                'text-3xl font-bold tracking-tight text-zinc-50',
                questDone != null && 'animate-quest-glow',
              )}
            >
              {project.title}
            </h1>
            {canEdit && (
              <button
                onClick={beginEditTitle}
                aria-label="Rename quest"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-indigo-400"
              >
                ✏
              </button>
            )}
          </div>
        )}

        {/* Epic / recurrence / missed badges */}
        {(label || missed || isEpic || isSubQuest || upcoming || countdown) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {upcoming && project.availableAt && (
              <span className="inline-flex items-center rounded-md bg-zinc-800 border border-zinc-600/50 px-2 py-0.5 text-xs font-medium text-zinc-300">
                ◷ Activates {formatActivatesIn(project.availableAt, timingNow)}
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
            {isEpic && (
              <span className="inline-flex items-center rounded-md bg-amber-950/40 border border-amber-500/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                ⚔ Epic{project.sequential ? ' · in order' : ''}
              </span>
            )}
            {isSubQuest && (
              <span className="inline-flex items-center rounded-md bg-indigo-950/40 border border-indigo-500/40 px-2 py-0.5 text-xs font-medium text-indigo-300">
                Sub-quest
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

        {locked && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            🔒 Locked — finish the earlier sub-quests first.
          </div>
        )}

        {titleError && (
          <p className="mt-1 text-sm text-red-400">{titleError}</p>
        )}

        {project.description && !editingTitle && (
          <p className="mt-2 text-zinc-400">{project.description}</p>
        )}

        {/* Icon */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
            Icon
          </label>
          <div className="flex items-center gap-3">
            {project.icon && (
              <img
                src={project.icon}
                alt=""
                loading="lazy"
                className="h-12 w-12 object-contain flex-shrink-0"
              />
            )}
            <IconPicker
              value={project.icon}
              onChange={handleIconChange}
              disabled={isSavingIcon || !canEdit}
            />
          </div>
          {iconError && <p className="mt-1 text-sm text-red-400">{iconError}</p>}
        </div>

        {/* Difficulty (scales quest-completion XP & card rarity) */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
            Difficulty
          </label>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => handleSetDifficulty(d.value)}
                disabled={isSavingDifficulty || !canEdit}
                aria-pressed={project.difficulty === d.value}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-60',
                  project.difficulty === d.value
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
        <div className="mt-4">
          <label htmlFor="ws-tag" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
            Tags
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {project.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-950/40 border border-indigo-500/40 px-2 py-0.5 text-xs font-medium text-indigo-200"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  disabled={isSavingTags || !canEdit}
                  aria-label={`Remove tag ${t}`}
                  className="text-indigo-400 hover:text-indigo-200 disabled:opacity-50"
                >
                  ✕
                </button>
              </span>
            ))}
            {canEdit && (
              <input
                id="ws-tag"
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                onBlur={handleAddTag}
                disabled={isSavingTags}
                placeholder="+ tag"
                className="field max-w-[8rem] py-1 text-sm"
              />
            )}
            {project.tags.length === 0 && !canEdit && (
              <span className="text-xs text-zinc-500">No tags</span>
            )}
          </div>
        </div>

        {/* Timing: becomes-active date + finish-by deadline (not for epics) */}
        {!isEpic && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ws-available" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
                Becomes active
              </label>
              <input
                id="ws-available"
                type="date"
                value={toDateInputValue(project.availableAt)}
                onChange={(e) => handleSetTiming(e.target.value, toDateInputValue(project.deadline))}
                disabled={isSavingTiming || !canEdit}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="ws-deadline" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
                Finish by
              </label>
              <input
                id="ws-deadline"
                type="date"
                value={toDateInputValue(project.deadline)}
                onChange={(e) => handleSetTiming(toDateInputValue(project.availableAt), e.target.value)}
                disabled={isSavingTiming || !canEdit}
                className="field"
              />
            </div>
          </div>
        )}

        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              {done}/{total} {progressUnit}{total !== 1 ? 's' : ''} completed
            </span>
            <span className="font-medium text-zinc-300">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      </div>

      {/* Party (shared quests) — members + owner's edit-permission toggle */}
      {isSharedQuest && (
        <Card>
          <CardHeader>
            <CardTitle>
              🧑‍🤝‍🧑 Party · {acceptedMembers.length + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOwner ? (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={project.membersCanEdit}
                  onCheckedChange={(c) => handleToggleMemberPerms(c === true)}
                  disabled={isSavingPerms}
                  aria-label="Let party members edit this quest"
                />
                <span className="text-sm text-zinc-300">
                  Let party members edit this quest
                  <span className="block text-xs text-zinc-500">
                    When on, members can add and edit objectives, inventory, and settings. They can always check off progress; only you can delete the quest.
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-sm text-zinc-400">
                {project.membersCanEdit
                  ? 'You can edit this shared quest — add and check off objectives and inventory.'
                  : 'You can check off progress on this shared quest. Only the owner can change its objectives and settings.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sub-quests (epic only) */}
      {isEpic && (
        <Card>
          <CardHeader>
            <CardTitle>Sub-quests</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
              <Checkbox
                checked={project.sequential}
                onCheckedChange={(c) => handleToggleSequential(c)}
                disabled={isMutatingEpic}
                aria-label="Sub-quests must be done in order"
              />
              <span className="text-sm text-zinc-300">
                Must be done in order
                <span className="text-zinc-500"> — later sub-quests lock 🔒 until earlier ones finish</span>
              </span>
            </label>

            {children.length === 0 ? (
              <p className="text-sm text-zinc-500">No sub-quests yet.</p>
            ) : (
              <ul className="space-y-2">
                {children.map((child, index) => {
                  const cp = questProgress(child, allProjects);
                  const childStatus = getQuestStatus(child, allProjects);
                  const childLocked = lockedIds.has(child.id);
                  const statusIcon = childLocked
                    ? '🔒'
                    : childStatus === 'completed'
                      ? '✓'
                      : '▶';
                  return (
                    <li
                      key={child.id}
                      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 group"
                    >
                      <span className="text-xs text-zinc-500 w-4 text-right tabular-nums">
                        {index + 1}
                      </span>
                      <span
                        className={cn(
                          'text-sm flex-shrink-0',
                          childLocked ? 'opacity-60' : '',
                          childStatus === 'completed' ? 'text-emerald-400' : 'text-zinc-400',
                        )}
                        aria-hidden
                      >
                        {statusIcon}
                      </span>
                      {childLocked ? (
                        <span className="text-sm flex-1 min-w-0 truncate text-zinc-500">
                          {child.title}
                        </span>
                      ) : (
                        <Link
                          href={`/projects/${child.id}`}
                          className={cn(
                            'text-sm flex-1 min-w-0 truncate hover:text-indigo-400 transition-colors',
                            childStatus === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-200',
                          )}
                        >
                          {child.title}
                        </Link>
                      )}
                      <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                        {cp.done}/{cp.total}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleReorderSubQuest(child.id, 'up')}
                          disabled={index === 0 || isMutatingEpic}
                          aria-label={`Move "${child.title}" up`}
                          className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors px-1 text-sm"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleReorderSubQuest(child.id, 'down')}
                          disabled={index === children.length - 1 || isMutatingEpic}
                          aria-label={`Move "${child.title}" down`}
                          className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors px-1 text-sm"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => handleDeleteSubQuest(child.id, child.title)}
                          aria-label={`Delete "${child.title}"`}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all px-1 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              onSubmit={handleAddSubQuest}
              className="mt-5 pt-4 border-t border-zinc-800/80 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubQuestTitle}
                  onChange={(e) => setNewSubQuestTitle(e.target.value)}
                  placeholder="Add a sub-quest…"
                  className="field flex-1"
                />
                <Button type="submit" disabled={isAddingSubQuest}>
                  {isAddingSubQuest ? 'Adding…' : 'Add'}
                </Button>
              </div>
              {subQuestError && <p className="text-sm text-red-400">{subQuestError}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Objectives */}
      {!isEpic && (
      <Card>
        <CardHeader>
          <CardTitle>Objectives</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit && (
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
              <Checkbox
                checked={project.sequentialObjectives}
                onCheckedChange={(c) => handleToggleSequentialObjectives(c === true)}
                disabled={isSavingSeqObj}
                aria-label="Objectives must be done in order"
              />
              <span className="text-sm text-zinc-300">
                Must be done in order
                <span className="text-zinc-500"> — later objectives lock 🔒 until earlier ones finish</span>
              </span>
            </label>
          )}
          {project.objectives.length === 0 ? (
            <p className="text-sm text-zinc-500">No objectives yet.</p>
          ) : (
            <ul className="space-y-1">
              {project.objectives.map((obj, idx) => {
                const isCelebrating = celebrate?.objId === obj.id;
                const objIsLocked = objLocked.has(obj.id);
                return (
                <li
                  key={obj.id}
                  className={cn(
                    'relative flex items-center gap-2 rounded-lg px-2 py-2 -mx-2 hover:bg-zinc-800/40 transition-colors group',
                    isCelebrating && 'animate-objective-glow',
                  )}
                >
                  {editingObjId === obj.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={objDraft}
                        onChange={(e) => setObjDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveObj(obj.id);
                          if (e.key === 'Escape') cancelEditObj();
                        }}
                        className="field flex-1 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveObj(obj.id)}
                        disabled={isSavingObj || !objDraft.trim()}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditObj}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="relative inline-flex flex-shrink-0">
                        <Checkbox
                          checked={obj.isCompleted}
                          onCheckedChange={() => handleToggle(obj.id)}
                          disabled={locked || objIsLocked}
                          className={cn(isCelebrating && 'animate-check-pop')}
                        />
                        {isCelebrating && <SparkleBurst key={celebrate.nonce} />}
                      </span>
                      <span
                        className={cn(
                          'text-sm flex-1 transition-colors',
                          obj.isCompleted
                            ? 'text-zinc-500 line-through'
                            : objIsLocked
                              ? 'text-zinc-500'
                              : 'text-zinc-200',
                        )}
                      >
                        {objIsLocked && <span aria-hidden className="mr-1">🔒</span>}
                        {obj.title}
                      </span>
                      {canEdit && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <button
                            onClick={() => handleReorderObjective(obj.id, 'up')}
                            disabled={idx === 0 || isMutatingObj}
                            aria-label={`Move "${obj.title}" up`}
                            className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors px-1 text-sm"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleReorderObjective(obj.id, 'down')}
                            disabled={idx === project.objectives.length - 1 || isMutatingObj}
                            aria-label={`Move "${obj.title}" down`}
                            className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors px-1 text-sm"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => beginEditObj(obj.id, obj.title)}
                            aria-label={`Rename "${obj.title}"`}
                            className="text-zinc-500 hover:text-indigo-400 transition-colors px-1 text-sm"
                          >
                            ✏
                          </button>
                          <button
                            onClick={() => handleDeleteObj(obj.id)}
                            aria-label={`Delete "${obj.title}"`}
                            className="text-zinc-500 hover:text-red-400 transition-colors px-1 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
                );
              })}
            </ul>
          )}

          {objEditError && (
            <p className="mt-2 text-sm text-red-400">{objEditError}</p>
          )}

          {canEdit && (
            <form
              onSubmit={handleAddObjective}
              className="mt-5 pt-4 border-t border-zinc-800/80 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newObjTitle}
                  onChange={(e) => setNewObjTitle(e.target.value)}
                  placeholder="Add an objective…"
                  className="field flex-1"
                />
                <Button type="submit" disabled={isAddingObj}>
                  {isAddingObj ? 'Adding…' : 'Add'}
                </Button>
              </div>
              {newObjError && (
                <p className="text-sm text-red-400">{newObjError}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
      )}

      {/* Schedule (standalone quests only — epics & sub-quests are non-recurring) */}
      {!isEpic && !isSubQuest && (
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="sched-recurrence"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Repeat
            </label>
            <select
              id="sched-recurrence"
              value={schedRecurrenceType}
              onChange={(e) => setSchedRecurrenceType(e.target.value as RecurrenceType)}
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

          {schedRecurrenceType === RecurrenceType.WEEKLY && (
            <div>
              <label
                htmlFor="sched-dow"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                Day of week
              </label>
              <select
                id="sched-dow"
                value={schedDayOfWeek}
                onChange={(e) => setSchedDayOfWeek(Number(e.target.value))}
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

          {schedRecurrenceType === RecurrenceType.EVERY_N_WEEKS && (
            <>
              <div>
                <label
                  htmlFor="sched-interval"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Every N weeks
                </label>
                <input
                  id="sched-interval"
                  type="number"
                  min={1}
                  value={schedIntervalWeeks}
                  onChange={(e) =>
                    setSchedIntervalWeeks(Math.max(1, Number(e.target.value)))
                  }
                  className="field"
                />
              </div>
              <div>
                <label
                  htmlFor="sched-dow-n"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Day of week
                </label>
                <select
                  id="sched-dow-n"
                  value={schedDayOfWeek}
                  onChange={(e) => setSchedDayOfWeek(Number(e.target.value))}
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

          {schedRecurrenceType === RecurrenceType.MONTHLY && (
            <div>
              <label
                htmlFor="sched-dom"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                Day of month
              </label>
              <input
                id="sched-dom"
                type="number"
                min={1}
                max={31}
                value={schedDayOfMonth}
                onChange={(e) =>
                  setSchedDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))
                }
                className="field"
              />
            </div>
          )}

          {schedRecurrenceType === RecurrenceType.SPECIFIC_DATE && (
            <div>
              <label
                htmlFor="sched-specific-date"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                Date
              </label>
              <input
                id="sched-specific-date"
                type="date"
                value={schedSpecificDate}
                onChange={(e) => setSchedSpecificDate(e.target.value)}
                className="field"
              />
            </div>
          )}

          {schedError && <p className="text-sm text-red-400">{schedError}</p>}

          <Button onClick={handleSaveSchedule} disabled={isSavingSched}>
            {isSavingSched ? 'Saving…' : 'Save schedule'}
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Inventory (not for epics) */}
      {!isEpic && (
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {project.inventoryItems.length === 0 ? (
            <p className="text-sm text-zinc-500">No inventory items yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/70">
              {project.inventoryItems.map((item, idx) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 py-3 first:pt-0 last:pb-0 group"
                >
                  {editingItemId === item.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={editItemDraft}
                        onChange={(e) => setEditItemDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveItemName(item.id);
                          if (e.key === 'Escape') cancelEditItem();
                        }}
                        className="field flex-1 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveItemName(item.id)}
                        disabled={isSavingItemName || !editItemDraft.trim()}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditItem}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Checkbox
                        checked={item.gathered}
                        onCheckedChange={() => handleToggleItem(item.id)}
                        aria-label={`Mark "${item.name}" as gathered`}
                      />
                      <span
                        className={cn(
                          'text-sm flex-1 min-w-0 truncate transition-colors',
                          item.gathered
                            ? 'text-zinc-500 line-through'
                            : 'text-zinc-200',
                        )}
                      >
                        {item.name}
                      </span>
                      {canEdit && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => handleReorderItem(item.id, 'up')}
                            disabled={idx === 0 || isMutatingItem}
                            aria-label={`Move "${item.name}" up`}
                            className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors px-1 text-sm"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleReorderItem(item.id, 'down')}
                            disabled={idx === project.inventoryItems.length - 1 || isMutatingItem}
                            aria-label={`Move "${item.name}" down`}
                            className="text-zinc-500 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors px-1 text-sm"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => beginEditItem(item.id, item.name)}
                            aria-label={`Rename "${item.name}"`}
                            className="text-zinc-500 hover:text-indigo-400 transition-colors px-1 text-sm"
                          >
                            ✏
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            aria-label={`Delete "${item.name}"`}
                            className="text-zinc-500 hover:text-red-400 transition-colors px-1 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {editItemError && (
            <p className="mt-2 text-sm text-red-400">{editItemError}</p>
          )}

          {canEdit && (
            <form
              onSubmit={handleAddItem}
              className="mt-5 pt-4 border-t border-zinc-800/80 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Add an item…"
                  className="field flex-1"
                />
                <Button type="submit" disabled={isAddingItem}>
                  {isAddingItem ? 'Adding…' : 'Add'}
                </Button>
              </div>
              {newItemError && (
                <p className="text-sm text-red-400">{newItemError}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
      )}
    </main>
  );
}
