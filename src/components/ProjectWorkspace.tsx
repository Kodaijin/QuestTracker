'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecurrenceType } from '@prisma/client';
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
} from '@/app/actions/projects';
import type { ProjectWithRelations } from '@/app/actions/projects';
import { recurrenceLabel, isMissed } from '@/lib/recurrence';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import IconPicker from '@/components/IconPicker';
import LogoutButton from '@/components/LogoutButton';

interface Props {
  initialProjects: ProjectWithRelations[];
  projectId: string;
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

export default function ProjectWorkspace({ initialProjects, projectId }: Props) {
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

  const total = project.objectives.length;
  const done = project.objectives.filter((o) => o.isCompleted).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

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

  // ── Handlers: toggle objective + gather item ──────────────────────────────────

  async function handleToggle(objectiveId: string) {
    const prev = optimisticToggle(objectiveId);
    try {
      await toggleObjective({ objectiveId });
    } catch {
      rollbackObjective(objectiveId, prev);
    }
  }

  async function handleToggleItem(itemId: string) {
    const prev = optimisticToggleItem(itemId);
    try {
      await toggleInventoryItem({ itemId });
    } catch {
      rollbackInventoryItem(itemId, prev);
    }
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
          >
            <span aria-hidden>←</span> Dashboard
          </Link>
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
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
              {project.title}
            </h1>
            <button
              onClick={beginEditTitle}
              aria-label="Rename quest"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-indigo-400"
            >
              ✏
            </button>
          </div>
        )}

        {/* Recurrence + missed badges */}
        {(label || missed) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
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
              disabled={isSavingIcon}
            />
          </div>
          {iconError && <p className="mt-1 text-sm text-red-400">{iconError}</p>}
        </div>

        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              {done}/{total} objective{total !== 1 ? 's' : ''} completed
            </span>
            <span className="font-medium text-zinc-300">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      </div>

      {/* Objectives */}
      <Card>
        <CardHeader>
          <CardTitle>Objectives</CardTitle>
        </CardHeader>
        <CardContent>
          {project.objectives.length === 0 ? (
            <p className="text-sm text-zinc-500">No objectives yet.</p>
          ) : (
            <ul className="space-y-1">
              {project.objectives.map((obj) => (
                <li
                  key={obj.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 -mx-2 hover:bg-zinc-800/40 transition-colors group"
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
                      <Checkbox
                        checked={obj.isCompleted}
                        onCheckedChange={() => handleToggle(obj.id)}
                      />
                      <span
                        className={cn(
                          'text-sm flex-1 transition-colors',
                          obj.isCompleted
                            ? 'text-zinc-500 line-through'
                            : 'text-zinc-200',
                        )}
                      >
                        {obj.title}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
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
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {objEditError && (
            <p className="mt-2 text-sm text-red-400">{objEditError}</p>
          )}

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
        </CardContent>
      </Card>

      {/* Schedule */}
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

      {/* Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {project.inventoryItems.length === 0 ? (
            <p className="text-sm text-zinc-500">No inventory items yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/70">
              {project.inventoryItems.map((item) => (
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
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
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
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {editItemError && (
            <p className="mt-2 text-sm text-red-400">{editItemError}</p>
          )}

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
        </CardContent>
      </Card>
    </main>
  );
}
