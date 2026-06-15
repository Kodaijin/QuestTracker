'use server';

import { getServerSession } from 'next-auth';
import { z } from 'zod';
import type { Project, Objective, InventoryItem } from '@prisma/client';
import { Prisma, RecurrenceType } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  computeFirstDueDate,
  computeNextDueDate,
  isCompletedThisCycle,
  type SchedulableQuest,
} from '@/lib/recurrence';

// ── Session guard ──────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
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
  })
  .merge(recurrenceSchema);

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
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(0, 'Quantity must be 0 or more')
    .optional(),
});

const toggleObjectiveSchema = z.object({
  objectiveId: z.string().min(1, 'objectiveId is required'),
});

const updateInventoryQuantitySchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(0, 'Quantity must be 0 or more'),
});

// ── Shared return type for getProjectsForUser ──────────────────────────────────

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { objectives: true; inventoryItems: true };
}>;

// ── Actions ────────────────────────────────────────────────────────────────────

export async function createProject(
  input: z.input<typeof createProjectSchema>,
): Promise<Project> {
  const userId = await requireUserId();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { title, description, icon, ...recInput } = parsed.data;
  const recFields = normaliseRecurrence(recInput);

  return prisma.project.create({
    data: {
      title,
      description: description ?? null,
      icon: icon ?? null,
      userId,
      recurrenceType: recFields.recurrenceType,
      dayOfWeek: recFields.dayOfWeek,
      intervalWeeks: recFields.intervalWeeks,
      dayOfMonth: recFields.dayOfMonth,
      specificDate: recFields.specificDate,
      dueDate: recFields.dueDate,
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

  const { projectId, name, quantity } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  return prisma.inventoryItem.create({
    data: { projectId, name, quantity: quantity ?? 0 },
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
        },
      },
    },
  });

  if (!objective) throw new Error('Objective not found');
  if (objective.project.userId !== userId) throw new Error('Unauthorized');

  const updated = await prisma.objective.update({
    where: { id: objectiveId },
    data: { isCompleted: !objective.isCompleted },
  });

  // When toggling results in all objectives completed, set lastCompletedAt on the project.
  // We only set it (never clear it) — leaving the historical value if it becomes incomplete again.
  if (updated.isCompleted) {
    const sibs = await prisma.objective.findMany({
      where: { projectId: objective.project.id },
      select: { isCompleted: true },
    });
    const allDone = sibs.length > 0 && sibs.every((o) => o.isCompleted);
    if (allDone) {
      await prisma.project.update({
        where: { id: objective.project.id },
        data: { lastCompletedAt: new Date() },
      });
    }
  }

  return updated;
}

export async function updateInventoryQuantity(
  input: z.infer<typeof updateInventoryQuantitySchema>,
): Promise<InventoryItem> {
  const userId = await requireUserId();

  const parsed = updateInventoryQuantitySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { itemId, quantity } = parsed.data;

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { project: { select: { userId: true } } },
  });

  if (!item) throw new Error('Item not found');
  if (item.project.userId !== userId) throw new Error('Unauthorized');

  return prisma.inventoryItem.update({
    where: { id: itemId },
    data: { quantity },
  });
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

  return prisma.project.findMany({
    where: { userId },
    include: {
      objectives: { orderBy: { order: 'asc' } },
      inventoryItems: true,
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
