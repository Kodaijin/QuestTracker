'use server';

import { getServerSession } from 'next-auth';
import { z } from 'zod';
import type { Project, Objective, InventoryItem } from '@prisma/client';
import { Prisma, RecurrenceType, CompletionType, Difficulty, InviteStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  computeFirstDueDate,
  computeNextDueDate,
  isCompletedThisCycle,
  type SchedulableQuest,
} from '@/lib/recurrence';
import { objectiveXp, itemXp, questXp } from '@/lib/progression';

// ── XP / completion-event helpers ────────────────────────────────────────────
//
// Every check-off writes a CompletionEvent (the source of truth for XP, streaks
// and insights). Un-checking removes the most recent matching event so XP can't
// be farmed by toggling. Recurrence rollover (syncRecurringQuests) deliberately
// does NOT remove events — that's what lets dailies accrue XP and streaks.

async function recordCompletionEvent(
  userId: string,
  type: CompletionType,
  projectId: string,
  xp: number,
): Promise<void> {
  await prisma.completionEvent.create({ data: { userId, type, projectId, xp } });
}

async function removeLatestCompletionEvent(
  userId: string,
  type: CompletionType,
  projectId: string,
): Promise<void> {
  const latest = await prisma.completionEvent.findFirst({
    where: { userId, type, projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (latest) await prisma.completionEvent.delete({ where: { id: latest.id } });
}

// ── Session guard ──────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

// ── Party / shared-quest helpers ─────────────────────────────────────────────
//
// A quest is owned by Project.userId, but may also be shared with accepted
// QuestMembers (see party.ts). Owners may edit a quest's structure; owners AND
// accepted members may check objectives/items off — and every participant earns
// (or, on un-check, forfeits) the resulting XP.

type QuestRole = 'owner' | 'member' | null;

/** Resolve the caller's relationship to a quest: owner, accepted member, or neither. */
async function getQuestRole(projectId: string, userId: string): Promise<QuestRole> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return null;
  if (project.userId === userId) return 'owner';

  const membership = await prisma.questMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { status: true },
  });
  return membership?.status === InviteStatus.ACCEPTED ? 'member' : null;
}

/** The owner plus every accepted member — i.e. who earns XP when the quest progresses. */
async function acceptedParticipantIds(projectId: string): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      members: { where: { status: InviteStatus.ACCEPTED }, select: { userId: true } },
    },
  });
  if (!project) return [];
  return [project.userId, ...project.members.map((m) => m.userId)];
}

/** Ids of the user's accepted connections (allies), usable as quest invitees. */
async function acceptedAllyIds(userId: string): Promise<Set<string>> {
  const connections = await prisma.connection.findMany({
    where: {
      status: InviteStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return new Set(connections.map((c) => (c.requesterId === userId ? c.addresseeId : c.requesterId)));
}

/**
 * Server-side mirror of `lockedSubQuestIds` for a single sub-quest: under a
 * `sequential` epic, a sub-quest is locked while any earlier sibling (by
 * `epicOrder`) is incomplete. Used to reject edits to locked sub-quests.
 */
async function isSubQuestLockedOnServer(
  parentId: string,
  subQuestId: string,
): Promise<boolean> {
  const parent = await prisma.project.findUnique({
    where: { id: parentId },
    select: {
      sequential: true,
      children: {
        orderBy: { epicOrder: 'asc' },
        select: { id: true, objectives: { select: { isCompleted: true } } },
      },
    },
  });
  if (!parent || !parent.sequential) return false;

  let blocked = false;
  for (const child of parent.children) {
    if (child.id === subQuestId) return blocked;
    const complete =
      child.objectives.length > 0 && child.objectives.every((o) => o.isCompleted);
    if (!complete) blocked = true;
  }
  return false;
}

// ── Recurrence schema ──────────────────────────────────────────────────────────

const recurrenceSchema = z
  .object({
    recurrenceType: z.nativeEnum(RecurrenceType).optional().default(RecurrenceType.NONE),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    intervalWeeks: z.number().int().min(1).nullable().optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    specificDate: z.string().nullable().optional(), // ISO date string from client
  })
  .superRefine((v, ctx) => {
    if (v.recurrenceType === RecurrenceType.WEEKLY) {
      if (v.dayOfWeek == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dayOfWeek is required for WEEKLY recurrence',
          path: ['dayOfWeek'],
        });
      }
    }
    if (v.recurrenceType === RecurrenceType.EVERY_N_WEEKS) {
      if (v.dayOfWeek == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dayOfWeek is required for EVERY_N_WEEKS recurrence',
          path: ['dayOfWeek'],
        });
      }
      if (v.intervalWeeks == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'intervalWeeks is required for EVERY_N_WEEKS recurrence',
          path: ['intervalWeeks'],
        });
      }
    }
    if (v.recurrenceType === RecurrenceType.MONTHLY) {
      if (v.dayOfMonth == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dayOfMonth is required for MONTHLY recurrence',
          path: ['dayOfMonth'],
        });
      }
    }
    if (v.recurrenceType === RecurrenceType.SPECIFIC_DATE) {
      if (!v.specificDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'specificDate is required for SPECIFIC_DATE recurrence',
          path: ['specificDate'],
        });
      }
    }
  });

type RecurrenceInput = z.infer<typeof recurrenceSchema>;

/** Normalise unused recurrence fields to null for storage, and convert specificDate string -> Date. */
function normaliseRecurrence(r: RecurrenceInput): {
  recurrenceType: RecurrenceType;
  dayOfWeek: number | null;
  intervalWeeks: number | null;
  dayOfMonth: number | null;
  specificDate: Date | null;
  dueDate: Date | null;
} {
  const type = r.recurrenceType;
  const specificDateObj =
    type === RecurrenceType.SPECIFIC_DATE && r.specificDate
      ? new Date(r.specificDate)
      : null;

  const cfg = {
    recurrenceType: type,
    dayOfWeek: type === RecurrenceType.WEEKLY || type === RecurrenceType.EVERY_N_WEEKS
      ? (r.dayOfWeek ?? null)
      : null,
    intervalWeeks: type === RecurrenceType.EVERY_N_WEEKS
      ? (r.intervalWeeks ?? null)
      : null,
    dayOfMonth: type === RecurrenceType.MONTHLY ? (r.dayOfMonth ?? null) : null,
    specificDate: specificDateObj,
  };

  const dueDate = computeFirstDueDate(cfg, new Date());

  return { ...cfg, dueDate };
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const updateProjectSchema = z
  .object({
    projectId: z.string().min(1, 'projectId is required'),
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().optional(),
  })
  .merge(recurrenceSchema);

const updateObjectiveSchema = z.object({
  objectiveId: z.string().min(1, 'objectiveId is required'),
  title: z.string().trim().min(1, 'Title is required'),
});

const deleteObjectiveSchema = z.object({
  objectiveId: z.string().min(1, 'objectiveId is required'),
});

const deleteProjectSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});

const renameInventoryItemSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  name: z.string().trim().min(1, 'Name is required'),
});

const deleteInventoryItemSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
});

const createProjectSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    icon: z
      .string()
      .startsWith('/icons/', 'icon path must start with /icons/')
      .nullable()
      .optional(),
    difficulty: z.nativeEnum(Difficulty).optional().default(Difficulty.NORMAL),
    tags: z
      .array(z.string().trim().min(1))
      .optional()
      .default([]),
    availableAt: z.string().nullable().optional(), // ISO; null/absent = active now
    deadline: z.string().nullable().optional(), // ISO finish-by date
    objectives: z
      .array(z.string().trim().min(1))
      .optional()
      .default([]),
    inventoryItems: z
      .array(z.string().trim().min(1))
      .optional()
      .default([]),
    isEpic: z.boolean().optional().default(false),
    sequential: z.boolean().optional().default(false),
    subQuests: z
      .array(z.string().trim().min(1))
      .optional()
      .default([]),
    // Accepted-ally user ids to share this quest with (non-epic quests only).
    memberIds: z.array(z.string().min(1)).optional().default([]),
  })
  .merge(recurrenceSchema);

const setDifficultySchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  difficulty: z.nativeEnum(Difficulty),
});

const setTagsSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  tags: z.array(z.string().trim().min(1)).max(20),
});

const setQuestTimingSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  availableAt: z.string().nullable(), // ISO; null = active now
  deadline: z.string().nullable(), // ISO; null = no deadline
});

const updateProjectIconSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  icon: z
    .string()
    .startsWith('/icons/', 'icon path must start with /icons/')
    .nullable(),
});

const createObjectiveSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  title: z.string().min(1, 'Title is required'),
});

const createInventoryItemSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  name: z.string().min(1, 'Name is required'),
});

const createSubQuestSchema = z.object({
  epicId: z.string().min(1, 'epicId is required'),
  title: z.string().trim().min(1, 'Title is required'),
});

const reorderSubQuestSchema = z.object({
  subQuestId: z.string().min(1, 'subQuestId is required'),
  direction: z.enum(['up', 'down']),
});

const updateEpicSettingsSchema = z.object({
  epicId: z.string().min(1, 'epicId is required'),
  sequential: z.boolean(),
});

const toggleObjectiveSchema = z.object({
  objectiveId: z.string().min(1, 'objectiveId is required'),
});

const toggleInventoryItemSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
});

// ── Shared return type for getProjectsForUser ──────────────────────────────────

export type QuestMemberWithUser = Prisma.QuestMemberGetPayload<{
  include: { user: { select: { id: true; username: true; name: true } } };
}>;

// `members` is only populated by getProjectsForUser (party-aware queries);
// computation helpers and other pages omit it, so it is optional.
export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { objectives: true; inventoryItems: true };
}> & { members?: QuestMemberWithUser[] };

// ── Actions ────────────────────────────────────────────────────────────────────

export async function createProject(
  input: z.input<typeof createProjectSchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const {
    title,
    description,
    icon,
    difficulty,
    tags,
    availableAt,
    deadline,
    objectives,
    inventoryItems,
    isEpic,
    sequential,
    subQuests,
    memberIds,
    ...recInput
  } = parsed.data;

  const cleanTags = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  const availableAtDate = availableAt ? new Date(availableAt) : null;
  const deadlineDate = deadline ? new Date(deadline) : null;

  // Epic quests are non-recurring containers; their content is sub-quests, which
  // are created as child projects (each a full quest fleshed out later).
  if (isEpic) {
    return prisma.project.create({
      data: {
        title,
        description: description ?? null,
        icon: icon ?? null,
        difficulty,
        tags: cleanTags,
        userId,
        isEpic: true,
        sequential,
        recurrenceType: RecurrenceType.NONE,
        children: {
          create: subQuests.map((subTitle, index) => ({
            title: subTitle,
            userId,
            epicOrder: index,
            recurrenceType: RecurrenceType.NONE,
          })),
        },
      },
    });
  }

  if (objectives.length === 0) {
    throw new Error('At least one objective is required');
  }

  const recFields = normaliseRecurrence(recInput);

  // Share with chosen allies (accepted connections only) as pending invites.
  const allyIds = memberIds.length > 0 ? await acceptedAllyIds(userId) : new Set<string>();
  const validMemberIds = Array.from(
    new Set(memberIds.filter((id) => id !== userId && allyIds.has(id))),
  );

  return prisma.project.create({
    data: {
      title,
      description: description ?? null,
      icon: icon ?? null,
      difficulty,
      tags: cleanTags,
      availableAt: availableAtDate,
      deadline: deadlineDate,
      userId,
      recurrenceType: recFields.recurrenceType,
      dayOfWeek: recFields.dayOfWeek,
      intervalWeeks: recFields.intervalWeeks,
      dayOfMonth: recFields.dayOfMonth,
      specificDate: recFields.specificDate,
      dueDate: recFields.dueDate,
      objectives: {
        create: objectives.map((objTitle, index) => ({
          title: objTitle,
          order: index + 1,
          isCompleted: false,
        })),
      },
      inventoryItems: {
        create: inventoryItems.map((name) => ({ name, gathered: false })),
      },
      members: {
        create: validMemberIds.map((memberId) => ({
          userId: memberId,
          status: InviteStatus.PENDING,
        })),
      },
    },
  });
}

export async function createObjective(
  input: z.infer<typeof createObjectiveSchema>,
): Promise<Objective> {
  const userId = await requireUserId();

  const parsed = createObjectiveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId, title } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  // Append to the end: next order is one past the current maximum.
  const last = await prisma.objective.findFirst({
    where: { projectId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  return prisma.objective.create({
    data: { projectId, title, order: nextOrder, isCompleted: false },
  });
}

export async function createInventoryItem(
  input: z.infer<typeof createInventoryItemSchema>,
): Promise<InventoryItem> {
  const userId = await requireUserId();

  const parsed = createInventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId, name } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  return prisma.inventoryItem.create({
    data: { projectId, name, gathered: false },
  });
}

export async function createSubQuest(
  input: z.infer<typeof createSubQuestSchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = createSubQuestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { epicId, title } = parsed.data;

  const epic = await prisma.project.findUnique({
    where: { id: epicId },
    select: { userId: true, isEpic: true, parentId: true },
  });
  if (!epic) throw new Error('Epic not found');
  if (epic.userId !== userId) throw new Error('Unauthorized');
  if (!epic.isEpic) throw new Error('Sub-quests can only be added to an epic');
  if (epic.parentId != null) {
    throw new Error('Sub-quests cannot be nested more than one level deep');
  }

  const last = await prisma.project.findFirst({
    where: { parentId: epicId },
    orderBy: { epicOrder: 'desc' },
    select: { epicOrder: true },
  });
  const nextOrder = (last?.epicOrder ?? -1) + 1;

  return prisma.project.create({
    data: {
      title,
      userId,
      parentId: epicId,
      epicOrder: nextOrder,
      recurrenceType: RecurrenceType.NONE,
    },
  });
}

export async function reorderSubQuest(
  input: z.infer<typeof reorderSubQuestSchema>,
): Promise<void> {
  const userId = await requireUserId();

  const parsed = reorderSubQuestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { subQuestId, direction } = parsed.data;

  const sub = await prisma.project.findUnique({
    where: { id: subQuestId },
    select: { userId: true, parentId: true },
  });
  if (!sub) throw new Error('Sub-quest not found');
  if (sub.userId !== userId) throw new Error('Unauthorized');
  if (sub.parentId == null) throw new Error('Not a sub-quest');

  const siblings = await prisma.project.findMany({
    where: { parentId: sub.parentId },
    orderBy: { epicOrder: 'asc' },
    select: { id: true, epicOrder: true },
  });

  const idx = siblings.findIndex((s) => s.id === subQuestId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) return; // no-op at the ends

  const a = siblings[idx];
  const b = siblings[swapIdx];
  await prisma.$transaction([
    prisma.project.update({ where: { id: a.id }, data: { epicOrder: b.epicOrder ?? swapIdx } }),
    prisma.project.update({ where: { id: b.id }, data: { epicOrder: a.epicOrder ?? idx } }),
  ]);
}

export async function updateEpicSettings(
  input: z.infer<typeof updateEpicSettingsSchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = updateEpicSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { epicId, sequential } = parsed.data;

  const epic = await prisma.project.findUnique({
    where: { id: epicId },
    select: { userId: true, isEpic: true },
  });
  if (!epic) throw new Error('Epic not found');
  if (epic.userId !== userId) throw new Error('Unauthorized');
  if (!epic.isEpic) throw new Error('Not an epic');

  return prisma.project.update({
    where: { id: epicId },
    data: { sequential },
  });
}

export async function toggleObjective(
  input: z.infer<typeof toggleObjectiveSchema>,
): Promise<Objective> {
  const userId = await requireUserId();

  const parsed = toggleObjectiveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { objectiveId } = parsed.data;

  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: {
      project: {
        select: {
          userId: true,
          id: true,
          parentId: true,
          difficulty: true,
        },
      },
    },
  });

  if (!objective) throw new Error('Objective not found');
  // Owner or accepted member may check objectives off (shared progress).
  if ((await getQuestRole(objective.project.id, userId)) === null) {
    throw new Error('Unauthorized');
  }

  // Hard-lock guard: a sub-quest under a sequential epic can't be touched until
  // its earlier siblings are complete.
  if (
    objective.project.parentId &&
    (await isSubQuestLockedOnServer(objective.project.parentId, objective.project.id))
  ) {
    throw new Error('This sub-quest is locked until earlier sub-quests are complete');
  }

  const projectId = objective.project.id;
  const updated = await prisma.objective.update({
    where: { id: objectiveId },
    data: { isCompleted: !objective.isCompleted },
  });

  // Recompute completion state to detect quest-level transitions and award XP.
  const sibs = await prisma.objective.findMany({
    where: { projectId },
    select: { id: true, isCompleted: true },
  });
  const nowComplete = sibs.length > 0 && sibs.every((o) => o.isCompleted);
  // Whether the quest was complete *before* this toggle: only possible when
  // un-checking, and only if every other objective was already done.
  const wasComplete =
    !updated.isCompleted && sibs.filter((o) => o.id !== objectiveId).every((o) => o.isCompleted);

  // Shared quests credit/claw-back XP for every participant (owner + accepted members).
  const participantIds = await acceptedParticipantIds(projectId);

  if (updated.isCompleted) {
    for (const pid of participantIds) {
      await recordCompletionEvent(pid, CompletionType.OBJECTIVE, projectId, objectiveXp());
    }
    // Quest just became complete → award the (difficulty-scaled) quest bonus.
    if (nowComplete) {
      for (const pid of participantIds) {
        await recordCompletionEvent(
          pid,
          CompletionType.QUEST,
          projectId,
          questXp(objective.project.difficulty),
        );
      }
      // Record the completion timestamp (set, never cleared).
      await prisma.project.update({
        where: { id: projectId },
        data: { lastCompletedAt: new Date() },
      });
    }
  } else {
    for (const pid of participantIds) {
      await removeLatestCompletionEvent(pid, CompletionType.OBJECTIVE, projectId);
    }
    // Quest dropped out of completion → claw back the most recent quest bonus.
    if (wasComplete) {
      for (const pid of participantIds) {
        await removeLatestCompletionEvent(pid, CompletionType.QUEST, projectId);
      }
    }
  }

  return updated;
}

export async function toggleInventoryItem(
  input: z.infer<typeof toggleInventoryItemSchema>,
): Promise<InventoryItem> {
  const userId = await requireUserId();

  const parsed = toggleInventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { itemId } = parsed.data;

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { project: { select: { userId: true } } },
  });

  if (!item) throw new Error('Item not found');
  // Owner or accepted member may gather items (shared progress).
  if ((await getQuestRole(item.projectId, userId)) === null) {
    throw new Error('Unauthorized');
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: itemId },
    data: { gathered: !item.gathered },
  });

  const participantIds = await acceptedParticipantIds(item.projectId);
  if (updated.gathered) {
    for (const pid of participantIds) {
      await recordCompletionEvent(pid, CompletionType.ITEM, item.projectId, itemXp());
    }
  } else {
    for (const pid of participantIds) {
      await removeLatestCompletionEvent(pid, CompletionType.ITEM, item.projectId);
    }
  }

  return updated;
}

export async function updateProject(
  input: z.input<typeof updateProjectSchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId, title, description, ...recInput } = parsed.data;
  const recFields = normaliseRecurrence(recInput);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  return prisma.project.update({
    where: { id: projectId },
    data: {
      title,
      description: description ?? null,
      recurrenceType: recFields.recurrenceType,
      dayOfWeek: recFields.dayOfWeek,
      intervalWeeks: recFields.intervalWeeks,
      dayOfMonth: recFields.dayOfMonth,
      specificDate: recFields.specificDate,
      dueDate: recFields.dueDate,
    },
  });
}

export async function updateObjective(
  input: z.infer<typeof updateObjectiveSchema>,
): Promise<Objective> {
  const userId = await requireUserId();

  const parsed = updateObjectiveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { objectiveId, title } = parsed.data;

  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: { project: { select: { userId: true } } },
  });
  if (!objective) throw new Error('Objective not found');
  if (objective.project.userId !== userId) throw new Error('Unauthorized');

  return prisma.objective.update({
    where: { id: objectiveId },
    data: { title },
  });
}

export async function deleteObjective(
  input: z.infer<typeof deleteObjectiveSchema>,
): Promise<void> {
  const userId = await requireUserId();

  const parsed = deleteObjectiveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { objectiveId } = parsed.data;

  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: { project: { select: { userId: true } } },
  });
  if (!objective) throw new Error('Objective not found');
  if (objective.project.userId !== userId) throw new Error('Unauthorized');

  await prisma.objective.delete({ where: { id: objectiveId } });
}

export async function renameInventoryItem(
  input: z.infer<typeof renameInventoryItemSchema>,
): Promise<InventoryItem> {
  const userId = await requireUserId();

  const parsed = renameInventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { itemId, name } = parsed.data;

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { project: { select: { userId: true } } },
  });
  if (!item) throw new Error('Item not found');
  if (item.project.userId !== userId) throw new Error('Unauthorized');

  return prisma.inventoryItem.update({
    where: { id: itemId },
    data: { name },
  });
}

export async function deleteInventoryItem(
  input: z.infer<typeof deleteInventoryItemSchema>,
): Promise<void> {
  const userId = await requireUserId();

  const parsed = deleteInventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { itemId } = parsed.data;

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { project: { select: { userId: true } } },
  });
  if (!item) throw new Error('Item not found');
  if (item.project.userId !== userId) throw new Error('Unauthorized');

  await prisma.inventoryItem.delete({ where: { id: itemId } });
}

export async function deleteProject(
  input: z.infer<typeof deleteProjectSchema>,
): Promise<void> {
  const userId = await requireUserId();

  const parsed = deleteProjectSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  await prisma.project.delete({ where: { id: projectId } });
}

export async function setDifficulty(
  input: z.infer<typeof setDifficultySchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = setDifficultySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId, difficulty } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  return prisma.project.update({
    where: { id: projectId },
    data: { difficulty },
  });
}

export async function setTags(
  input: z.infer<typeof setTagsSchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = setTagsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId, tags } = parsed.data;
  const cleanTags = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  return prisma.project.update({
    where: { id: projectId },
    data: { tags: cleanTags },
  });
}

export async function setQuestTiming(
  input: z.infer<typeof setQuestTimingSchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = setQuestTimingSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId, availableAt, deadline } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  return prisma.project.update({
    where: { id: projectId },
    data: {
      availableAt: availableAt ? new Date(availableAt) : null,
      deadline: deadline ? new Date(deadline) : null,
    },
  });
}

export async function updateProjectIcon(input: {
  projectId: string;
  icon: string | null;
}): Promise<Project> {
  const userId = await requireUserId();

  const parsed = updateProjectIconSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { projectId, icon } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  return prisma.project.update({
    where: { id: projectId },
    data: { icon },
  });
}

export async function getProjectsForUser(): Promise<ProjectWithRelations[]> {
  const userId = await requireUserId();

  // Own quests + quests shared with the user that they've accepted.
  return prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId, status: InviteStatus.ACCEPTED } } },
      ],
    },
    include: {
      objectives: { orderBy: { order: 'asc' } },
      inventoryItems: true,
      members: { include: { user: { select: { id: true, username: true, name: true } } } },
    },
  });
}

/**
 * For every recurring quest belonging to the current user that has elapsed its
 * dueDate AND was completed this cycle, advances the dueDate to the next
 * occurrence and resets all objectives to unchecked.
 *
 * Missed quests (dueDate elapsed but NOT completed) are left untouched.
 * SPECIFIC_DATE quests never roll over (no next occurrence).
 */
export async function syncRecurringQuests(): Promise<void> {
  const userId = await requireUserId();

  const projects = await prisma.project.findMany({
    where: {
      userId,
      NOT: { recurrenceType: RecurrenceType.NONE },
    },
    include: { objectives: { select: { isCompleted: true } } },
  });

  const now = new Date();

  for (const project of projects) {
    if (!project.dueDate) continue;

    const quest: SchedulableQuest = {
      recurrenceType: project.recurrenceType,
      dayOfWeek: project.dayOfWeek,
      intervalWeeks: project.intervalWeeks,
      dayOfMonth: project.dayOfMonth,
      specificDate: project.specificDate,
      dueDate: project.dueDate,
      objectives: project.objectives,
    };

    // Only roll over when: completed this cycle AND the due date has passed.
    if (!isCompletedThisCycle(quest) || now <= project.dueDate) continue;

    // SPECIFIC_DATE has no next occurrence — nothing to roll over to.
    if (project.recurrenceType === RecurrenceType.SPECIFIC_DATE) continue;

    // Advance dueDate past `now`, handling multiple elapsed periods.
    let nextDue = computeNextDueDate(quest, project.dueDate);
    if (nextDue == null) continue;

    while (nextDue != null && nextDue < now) {
      const following = computeNextDueDate(quest, nextDue);
      if (following == null) break;
      nextDue = following;
    }

    // Persist reset in a transaction.
    await prisma.$transaction([
      prisma.objective.updateMany({
        where: { projectId: project.id },
        data: { isCompleted: false },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: {
          dueDate: nextDue,
          lastCompletedAt: project.dueDate, // record the cycle just completed
        },
      }),
    ]);
  }
}
