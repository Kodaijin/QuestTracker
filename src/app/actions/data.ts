'use server';

import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Difficulty, RecurrenceType } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeFirstDueDate } from '@/lib/recurrence';

// ── Quest data export / import ───────────────────────────────────────────────
//
// A portable, self-contained JSON snapshot of the user's OWN quests (top-level
// quests and epics with their sub-quests, objectives, and inventory). It carries
// no ids, XP, party membership, or completion-event history — XP/streaks stay
// derived from the (farm-proof) CompletionEvent log, so importing never mints XP.

const EXPORT_VERSION = 1;
const MAX_IMPORT_QUESTS = 500;

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

// ── Export ───────────────────────────────────────────────────────────────────

export interface ExportedObjective {
  title: string;
  isCompleted: boolean;
}
export interface ExportedItem {
  name: string;
  gathered: boolean;
}
export interface ExportedQuest {
  title: string;
  description: string | null;
  icon: string | null;
  difficulty: Difficulty;
  tags: string[];
  isEpic: boolean;
  sequential: boolean;
  sequentialObjectives: boolean;
  recurrenceType: RecurrenceType;
  dayOfWeek: number | null;
  intervalWeeks: number | null;
  dayOfMonth: number | null;
  specificDate: string | null;
  availableAt: string | null;
  deadline: string | null;
  objectives: ExportedObjective[];
  inventoryItems: ExportedItem[];
  subQuests: ExportedQuest[];
}
export interface QuestExport {
  app: 'QuestTracker';
  version: number;
  exportedAt: string;
  quests: ExportedQuest[];
}

type DbQuest = {
  title: string;
  description: string | null;
  icon: string | null;
  difficulty: Difficulty;
  tags: string[];
  isEpic: boolean;
  sequential: boolean;
  sequentialObjectives: boolean;
  recurrenceType: RecurrenceType;
  dayOfWeek: number | null;
  intervalWeeks: number | null;
  dayOfMonth: number | null;
  specificDate: Date | null;
  availableAt: Date | null;
  deadline: Date | null;
  objectives: { title: string; isCompleted: boolean }[];
  inventoryItems: { name: string; gathered: boolean }[];
};

function serializeQuest(q: DbQuest, subQuests: ExportedQuest[]): ExportedQuest {
  return {
    title: q.title,
    description: q.description,
    icon: q.icon,
    difficulty: q.difficulty,
    tags: q.tags,
    isEpic: q.isEpic,
    sequential: q.sequential,
    sequentialObjectives: q.sequentialObjectives,
    recurrenceType: q.recurrenceType,
    dayOfWeek: q.dayOfWeek,
    intervalWeeks: q.intervalWeeks,
    dayOfMonth: q.dayOfMonth,
    specificDate: q.specificDate ? q.specificDate.toISOString() : null,
    availableAt: q.availableAt ? q.availableAt.toISOString() : null,
    deadline: q.deadline ? q.deadline.toISOString() : null,
    objectives: q.objectives.map((o) => ({ title: o.title, isCompleted: o.isCompleted })),
    inventoryItems: q.inventoryItems.map((i) => ({ name: i.name, gathered: i.gathered })),
    subQuests,
  };
}

export async function exportQuests(): Promise<QuestExport> {
  const userId = await requireUserId();

  const childInclude = {
    objectives: { orderBy: { order: 'asc' } },
    inventoryItems: { orderBy: { order: 'asc' } },
  } as const;

  const projects = await prisma.project.findMany({
    where: { userId, parentId: null },
    orderBy: { sortOrder: 'asc' },
    include: {
      ...childInclude,
      children: { include: childInclude, orderBy: { epicOrder: 'asc' } },
    },
  });

  const quests = projects.map((p) =>
    serializeQuest(
      p,
      p.children.map((c) => serializeQuest(c, [])),
    ),
  );

  return {
    app: 'QuestTracker',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    quests,
  };
}

// ── Import ───────────────────────────────────────────────────────────────────

const objectiveSchema = z.object({
  title: z.string().trim().min(1),
  isCompleted: z.boolean().optional().default(false),
});

const itemSchema = z.object({
  name: z.string().trim().min(1),
  gathered: z.boolean().optional().default(false),
});

// Recurrence/timing fields are lenient: anything malformed falls back to a sane
// default rather than rejecting the whole import.
const questSchema: z.ZodType<ImportedQuest> = z.lazy(() =>
  z.object({
    title: z.string().trim().min(1),
    description: z.string().nullish(),
    icon: z.string().nullish(),
    difficulty: z.nativeEnum(Difficulty).optional().default(Difficulty.NORMAL),
    tags: z.array(z.string().trim().min(1)).optional().default([]),
    isEpic: z.boolean().optional().default(false),
    sequential: z.boolean().optional().default(false),
    sequentialObjectives: z.boolean().optional().default(false),
    recurrenceType: z.nativeEnum(RecurrenceType).optional().default(RecurrenceType.NONE),
    dayOfWeek: z.number().int().min(0).max(6).nullish(),
    intervalWeeks: z.number().int().min(1).nullish(),
    dayOfMonth: z.number().int().min(1).max(31).nullish(),
    specificDate: z.string().nullish(),
    availableAt: z.string().nullish(),
    deadline: z.string().nullish(),
    objectives: z.array(objectiveSchema).optional().default([]),
    inventoryItems: z.array(itemSchema).optional().default([]),
    subQuests: z.array(questSchema).optional().default([]),
  }),
);

interface ImportedQuest {
  title: string;
  description?: string | null;
  icon?: string | null;
  difficulty: Difficulty;
  tags: string[];
  isEpic: boolean;
  sequential: boolean;
  sequentialObjectives: boolean;
  recurrenceType: RecurrenceType;
  dayOfWeek?: number | null;
  intervalWeeks?: number | null;
  dayOfMonth?: number | null;
  specificDate?: string | null;
  availableAt?: string | null;
  deadline?: string | null;
  objectives: { title: string; isCompleted: boolean }[];
  inventoryItems: { name: string; gathered: boolean }[];
  subQuests: ImportedQuest[];
}

const importSchema = z.object({
  quests: z.array(questSchema).max(MAX_IMPORT_QUESTS),
});

function cleanIcon(icon: string | null | undefined): string | null {
  return icon && icon.startsWith('/icons/') ? icon : null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Resolve a quest's recurrence config and its first due date, the way creation does. */
function recurrenceFor(q: ImportedQuest) {
  const type = q.recurrenceType;
  const cfg = {
    recurrenceType: type,
    dayOfWeek:
      type === RecurrenceType.WEEKLY || type === RecurrenceType.EVERY_N_WEEKS
        ? q.dayOfWeek ?? null
        : null,
    intervalWeeks: type === RecurrenceType.EVERY_N_WEEKS ? q.intervalWeeks ?? null : null,
    dayOfMonth: type === RecurrenceType.MONTHLY ? q.dayOfMonth ?? null : null,
    specificDate:
      type === RecurrenceType.SPECIFIC_DATE ? parseDate(q.specificDate) : null,
  };
  return { ...cfg, dueDate: computeFirstDueDate(cfg, new Date()) };
}

export async function importQuests(
  input: unknown,
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  const userId = await requireUserId();

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'That file is not a valid QuestTracker export.' };
  }

  const quests = parsed.data.quests;
  if (quests.length === 0) {
    return { ok: false, error: 'The file contains no quests to import.' };
  }

  const last = await prisma.project.findFirst({
    where: { userId, parentId: null },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  let nextSort = (last?.sortOrder ?? 0) + 1;

  let imported = 0;
  for (const q of quests) {
    const tags = Array.from(new Set(q.tags.map((t) => t.trim()).filter(Boolean)));

    if (q.isEpic) {
      await prisma.project.create({
        data: {
          title: q.title,
          description: q.description ?? null,
          icon: cleanIcon(q.icon),
          difficulty: q.difficulty,
          tags,
          userId,
          isEpic: true,
          sequential: q.sequential,
          sortOrder: nextSort++,
          recurrenceType: RecurrenceType.NONE,
          children: {
            create: q.subQuests.map((sub, index) => ({
              title: sub.title,
              description: sub.description ?? null,
              icon: cleanIcon(sub.icon),
              difficulty: sub.difficulty,
              tags: Array.from(new Set(sub.tags.map((t) => t.trim()).filter(Boolean))),
              userId,
              epicOrder: index,
              sequentialObjectives: sub.sequentialObjectives,
              recurrenceType: RecurrenceType.NONE,
              objectives: {
                create: sub.objectives.map((o, i) => ({
                  title: o.title,
                  order: i + 1,
                  isCompleted: o.isCompleted,
                })),
              },
              inventoryItems: {
                create: sub.inventoryItems.map((it, i) => ({
                  name: it.name,
                  gathered: it.gathered,
                  order: i + 1,
                })),
              },
            })),
          },
        },
      });
      imported += 1;
      continue;
    }

    const rec = recurrenceFor(q);
    await prisma.project.create({
      data: {
        title: q.title,
        description: q.description ?? null,
        icon: cleanIcon(q.icon),
        difficulty: q.difficulty,
        tags,
        userId,
        sortOrder: nextSort++,
        sequentialObjectives: q.sequentialObjectives,
        availableAt: parseDate(q.availableAt),
        deadline: parseDate(q.deadline),
        recurrenceType: rec.recurrenceType,
        dayOfWeek: rec.dayOfWeek,
        intervalWeeks: rec.intervalWeeks,
        dayOfMonth: rec.dayOfMonth,
        specificDate: rec.specificDate,
        dueDate: rec.dueDate,
        objectives: {
          create: q.objectives.map((o, i) => ({
            title: o.title,
            order: i + 1,
            isCompleted: o.isCompleted,
          })),
        },
        inventoryItems: {
          create: q.inventoryItems.map((it, i) => ({
            name: it.name,
            gathered: it.gathered,
            order: i + 1,
          })),
        },
      },
    });
    imported += 1;
  }

  return { ok: true, imported };
}
