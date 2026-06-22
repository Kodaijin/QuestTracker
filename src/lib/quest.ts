import type { ProjectWithRelations } from '@/app/actions/projects';

export type QuestStatus = 'accepted' | 'in-progress' | 'completed';

/** Sub-quests of an epic, sorted by their position within it. */
export function getChildren(
  project: ProjectWithRelations,
  all: ProjectWithRelations[],
): ProjectWithRelations[] {
  return all
    .filter((p) => p.parentId === project.id)
    .sort((a, b) => (a.epicOrder ?? 0) - (b.epicOrder ?? 0));
}

/**
 * Whether a quest counts as fully complete.
 * - Epic: has ≥1 sub-quest and every sub-quest is complete.
 * - Normal/sub-quest: has ≥1 objective and all are completed.
 */
export function isQuestComplete(
  project: ProjectWithRelations,
  all: ProjectWithRelations[],
): boolean {
  if (project.isEpic) {
    const children = getChildren(project, all);
    return children.length > 0 && children.every((c) => isQuestComplete(c, all));
  }
  const total = project.objectives.length;
  return total > 0 && project.objectives.every((o) => o.isCompleted);
}

/** How many objectives (or sub-quests, for an epic) are done out of the total. */
export function questProgress(
  project: ProjectWithRelations,
  all: ProjectWithRelations[],
): { done: number; total: number } {
  if (project.isEpic) {
    const children = getChildren(project, all);
    return {
      done: children.filter((c) => isQuestComplete(c, all)).length,
      total: children.length,
    };
  }
  return {
    done: project.objectives.filter((o) => o.isCompleted).length,
    total: project.objectives.length,
  };
}

/** Tri-state status used for dashboard buckets and card accents. */
export function getQuestStatus(
  project: ProjectWithRelations,
  all: ProjectWithRelations[],
): QuestStatus {
  const { done, total } = questProgress(project, all);
  if (total === 0) return 'accepted';
  if (done === total) return 'completed';
  if (done > 0) return 'in-progress';
  return 'accepted';
}

/**
 * For a `sequential` epic, returns the set of sub-quest ids that are locked:
 * a sub-quest is locked until every earlier sub-quest (by `epicOrder`) is
 * complete. Returns an empty set for non-sequential epics and non-epics.
 */
export function lockedSubQuestIds(
  epic: ProjectWithRelations,
  all: ProjectWithRelations[],
): Set<string> {
  const locked = new Set<string>();
  if (!epic.isEpic || !epic.sequential) return locked;

  const children = getChildren(epic, all);
  let blocked = false;
  for (const child of children) {
    if (blocked) {
      locked.add(child.id);
      continue;
    }
    if (!isQuestComplete(child, all)) {
      // This one is the active sub-quest; everything after it is locked.
      blocked = true;
    }
  }
  return locked;
}

/**
 * For a quest with `sequentialObjectives`, returns the set of objective ids whose
 * checkbox should be disabled. Objectives are walked in `order`; a valid state is
 * a run of completed ones followed by incomplete ones, so only the boundary is
 * actionable: the first incomplete objective (to check next) and the last
 * completed one (to step back). Everything else is locked. Returns an empty set
 * when sequencing is off.
 */
export function lockedObjectiveIds(project: ProjectWithRelations): Set<string> {
  const locked = new Set<string>();
  if (!project.sequentialObjectives) return locked;

  const ordered = [...project.objectives].sort((a, b) => a.order - b.order);
  const firstIncomplete = ordered.findIndex((o) => !o.isCompleted);

  ordered.forEach((o, i) => {
    if (firstIncomplete === -1) {
      // All complete: only the final objective may be un-checked.
      if (i !== ordered.length - 1) locked.add(o.id);
    } else if (i !== firstIncomplete && i !== firstIncomplete - 1) {
      // Otherwise only the next-to-check and the last-completed are actionable.
      locked.add(o.id);
    }
  });
  return locked;
}

/**
 * Whether a single sub-quest is currently locked. Convenience wrapper around
 * {@link lockedSubQuestIds} for the sub-quest workspace, which only has the
 * child + the full list.
 */
export function isSubQuestLocked(
  subQuest: ProjectWithRelations,
  all: ProjectWithRelations[],
): boolean {
  if (subQuest.parentId == null) return false;
  const parent = all.find((p) => p.id === subQuest.parentId);
  if (!parent) return false;
  return lockedSubQuestIds(parent, all).has(subQuest.id);
}
