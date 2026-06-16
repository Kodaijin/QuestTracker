import { RecurrenceType } from '@prisma/client';
import type { ProjectWithRelations } from '@/app/actions/projects';
import { getChildren, isQuestComplete } from '@/lib/quest';

/**
 * Aggregate snapshot of a user's quest activity, computed from their current
 * projects. Achievement predicates run against this shape.
 *
 * Note: stats reflect *current* state. Achievements, once unlocked, are stored
 * in the DB and never revoked — so a milestone earned then "undone" (e.g. a
 * recurring quest resetting) stays earned.
 */
export type QuestStats = {
  totalQuests: number;
  completedQuests: number;
  inProgressQuests: number;
  acceptedQuests: number;
  totalObjectives: number;
  completedObjectives: number;
  totalItems: number;
  gatheredItems: number;
  questsWithIcon: number;
  questsWithDescription: number;
  recurringQuests: number;
  dailyQuests: number;
  weeklyQuests: number;
  monthlyQuests: number;
  scheduledQuests: number; // any recurrence incl. specific date
  maxObjectivesInQuest: number;
  questsFullyGathered: number; // has items AND every item gathered
  completedQuestsWithInventory: number;
  longestTitleLength: number;
  epicsCreated: number;
  epicsCompleted: number;
  maxSubQuests: number;
  // Streak stats are derived from the CompletionEvent log (not from projects),
  // so computeStats defaults them to 0 — the caller fills them in.
  currentStreak: number;
  longestStreak: number;
};

export type Achievement = {
  key: string;
  name: string;
  icon: string; // emoji
  description: string;
  /** Returns true once the achievement's condition is met. */
  check: (s: QuestStats) => boolean;
};

/** Build a QuestStats snapshot from a user's projects + their relations. */
export function computeStats(projects: ProjectWithRelations[]): QuestStats {
  const s: QuestStats = {
    totalQuests: projects.length,
    completedQuests: 0,
    inProgressQuests: 0,
    acceptedQuests: 0,
    totalObjectives: 0,
    completedObjectives: 0,
    totalItems: 0,
    gatheredItems: 0,
    questsWithIcon: 0,
    questsWithDescription: 0,
    recurringQuests: 0,
    dailyQuests: 0,
    weeklyQuests: 0,
    monthlyQuests: 0,
    scheduledQuests: 0,
    maxObjectivesInQuest: 0,
    questsFullyGathered: 0,
    completedQuestsWithInventory: 0,
    longestTitleLength: 0,
    epicsCreated: 0,
    epicsCompleted: 0,
    maxSubQuests: 0,
    currentStreak: 0,
    longestStreak: 0,
  };

  for (const p of projects) {
    if (p.isEpic) {
      s.epicsCreated++;
      const subQuests = getChildren(p, projects);
      s.maxSubQuests = Math.max(s.maxSubQuests, subQuests.length);
      if (isQuestComplete(p, projects)) s.epicsCompleted++;
      s.longestTitleLength = Math.max(s.longestTitleLength, p.title.length);
      continue; // epics have no direct objectives/inventory of their own
    }

    const total = p.objectives.length;
    const done = p.objectives.filter((o) => o.isCompleted).length;
    const completed = total > 0 && done === total;

    if (completed) s.completedQuests++;
    else if (done > 0) s.inProgressQuests++;
    else s.acceptedQuests++;

    s.totalObjectives += total;
    s.completedObjectives += done;
    s.maxObjectivesInQuest = Math.max(s.maxObjectivesInQuest, total);

    const items = p.inventoryItems.length;
    const gathered = p.inventoryItems.filter((i) => i.gathered).length;
    s.totalItems += items;
    s.gatheredItems += gathered;
    if (items > 0 && gathered === items) s.questsFullyGathered++;
    if (completed && items > 0) s.completedQuestsWithInventory++;

    if (p.icon) s.questsWithIcon++;
    if (p.description && p.description.trim().length > 0) s.questsWithDescription++;

    if (p.recurrenceType !== RecurrenceType.NONE) s.scheduledQuests++;
    if (p.recurrenceType === RecurrenceType.DAILY) s.dailyQuests++;
    if (p.recurrenceType === RecurrenceType.WEEKLY) s.weeklyQuests++;
    if (p.recurrenceType === RecurrenceType.MONTHLY) s.monthlyQuests++;
    if (
      p.recurrenceType === RecurrenceType.DAILY ||
      p.recurrenceType === RecurrenceType.WEEKLY ||
      p.recurrenceType === RecurrenceType.EVERY_N_WEEKS ||
      p.recurrenceType === RecurrenceType.MONTHLY
    ) {
      s.recurringQuests++;
    }

    s.longestTitleLength = Math.max(s.longestTitleLength, p.title.length);
  }

  return s;
}

/**
 * The achievement catalog — 50 cheeky, usage-driven badges. Order here is the
 * display order (roughly easiest → hardest).
 */
export const ACHIEVEMENTS: Achievement[] = [
  // ── Getting started ───────────────────────────────────────────────────────
  { key: 'first-quest', name: 'A Hero Is Born', icon: '🌱', description: 'Create your very first quest.', check: (s) => s.totalQuests >= 1 },
  { key: 'first-objective', name: 'Baby Steps', icon: '👣', description: 'Add your first objective.', check: (s) => s.totalObjectives >= 1 },
  { key: 'first-complete', name: 'Quest Complete!', icon: '✅', description: 'Complete your first quest.', check: (s) => s.completedQuests >= 1 },
  { key: 'first-item', name: 'Pack Rat', icon: '🎒', description: 'Add your first inventory item.', check: (s) => s.totalItems >= 1 },
  { key: 'first-gather', name: 'Finders Keepers', icon: '🔎', description: 'Gather your first item.', check: (s) => s.gatheredItems >= 1 },
  { key: 'first-icon', name: 'Dressed To Impress', icon: '🎨', description: 'Give a quest an icon.', check: (s) => s.questsWithIcon >= 1 },
  { key: 'first-description', name: 'Lore Keeper', icon: '📜', description: 'Write a quest description.', check: (s) => s.questsWithDescription >= 1 },
  { key: 'first-schedule', name: 'Mark My Calendar', icon: '📅', description: 'Schedule a recurring quest.', check: (s) => s.scheduledQuests >= 1 },

  // ── Quest creation milestones ─────────────────────────────────────────────
  { key: 'quests-5', name: 'Quest Curious', icon: '🗺️', description: 'Have 5 quests on the board.', check: (s) => s.totalQuests >= 5 },
  { key: 'quests-10', name: 'Adventurer', icon: '⚔️', description: 'Juggle 10 quests at once.', check: (s) => s.totalQuests >= 10 },
  { key: 'quests-25', name: 'Quest Hoarder', icon: '📚', description: 'Amass 25 quests.', check: (s) => s.totalQuests >= 25 },
  { key: 'quests-50', name: 'Guild Master', icon: '🏰', description: 'Run a board of 50 quests.', check: (s) => s.totalQuests >= 50 },
  { key: 'quests-100', name: 'Bit Off More Than You Can Chew', icon: '🐉', description: 'Reach 100 quests. Brave.', check: (s) => s.totalQuests >= 100 },

  // ── Quest completion milestones ───────────────────────────────────────────
  { key: 'complete-5', name: 'On A Roll', icon: '🎲', description: 'Complete 5 quests.', check: (s) => s.completedQuests >= 5 },
  { key: 'complete-10', name: 'Closer', icon: '🏁', description: 'Complete 10 quests.', check: (s) => s.completedQuests >= 10 },
  { key: 'complete-25', name: 'Slayer Of To-Dos', icon: '🗡️', description: 'Complete 25 quests.', check: (s) => s.completedQuests >= 25 },
  { key: 'complete-50', name: 'Legendary Finisher', icon: '🌟', description: 'Complete 50 quests.', check: (s) => s.completedQuests >= 50 },
  { key: 'complete-100', name: 'The Completionist', icon: '👑', description: 'Complete 100 quests. Touch grass?', check: (s) => s.completedQuests >= 100 },

  // ── Objective grind ───────────────────────────────────────────────────────
  { key: 'obj-done-10', name: 'Checkbox Enjoyer', icon: '☑️', description: 'Check off 10 objectives.', check: (s) => s.completedObjectives >= 10 },
  { key: 'obj-done-50', name: 'Tick Tick Boom', icon: '💥', description: 'Check off 50 objectives.', check: (s) => s.completedObjectives >= 50 },
  { key: 'obj-done-100', name: 'Death By A Thousand Checks', icon: '🔪', description: 'Check off 100 objectives.', check: (s) => s.completedObjectives >= 100 },
  { key: 'obj-done-250', name: 'The Grind Never Stops', icon: '⚙️', description: 'Check off 250 objectives.', check: (s) => s.completedObjectives >= 250 },
  { key: 'obj-total-50', name: 'Big Planner', icon: '🧠', description: 'Write 50 objectives across your quests.', check: (s) => s.totalObjectives >= 50 },

  // ── Single-quest heft ─────────────────────────────────────────────────────
  { key: 'quest-5-obj', name: 'Detailed', icon: '📋', description: 'Build a quest with 5+ objectives.', check: (s) => s.maxObjectivesInQuest >= 5 },
  { key: 'quest-10-obj', name: 'Scope Creep', icon: '🪜', description: 'Build a quest with 10+ objectives.', check: (s) => s.maxObjectivesInQuest >= 10 },
  { key: 'quest-20-obj', name: 'Epic Quest', icon: '🏔️', description: 'A single quest with 20+ objectives.', check: (s) => s.maxObjectivesInQuest >= 20 },

  // ── Inventory ─────────────────────────────────────────────────────────────
  { key: 'gather-10', name: 'Looter', icon: '💎', description: 'Gather 10 items.', check: (s) => s.gatheredItems >= 10 },
  { key: 'gather-50', name: 'Master Forager', icon: '🍄', description: 'Gather 50 items.', check: (s) => s.gatheredItems >= 50 },
  { key: 'gather-100', name: 'Dragon Hoard', icon: '🪙', description: 'Gather 100 items.', check: (s) => s.gatheredItems >= 100 },
  { key: 'items-10', name: 'Shopping List', icon: '🧾', description: 'Track 10 inventory items.', check: (s) => s.totalItems >= 10 },
  { key: 'full-gather', name: 'Came Prepared', icon: '🎯', description: 'Fully gather every item in a quest.', check: (s) => s.questsFullyGathered >= 1 },
  { key: 'full-gather-5', name: 'Quartermaster', icon: '📦', description: 'Fully stock 5 quests.', check: (s) => s.questsFullyGathered >= 5 },
  { key: 'prepared-finish', name: 'No Loose Ends', icon: '🧶', description: 'Complete a quest that had inventory items.', check: (s) => s.completedQuestsWithInventory >= 1 },

  // ── Scheduling habits ─────────────────────────────────────────────────────
  { key: 'daily-quest', name: 'Creature Of Habit', icon: '🔁', description: 'Set up a daily quest.', check: (s) => s.dailyQuests >= 1 },
  { key: 'weekly-quest', name: 'Weekly Warrior', icon: '🗓️', description: 'Set up a weekly quest.', check: (s) => s.weeklyQuests >= 1 },
  { key: 'monthly-quest', name: 'Long Hauler', icon: '🌙', description: 'Set up a monthly quest.', check: (s) => s.monthlyQuests >= 1 },
  { key: 'recurring-5', name: 'Routine Machine', icon: '🤖', description: 'Run 5 recurring quests.', check: (s) => s.recurringQuests >= 5 },
  { key: 'recurring-10', name: 'Clockwork', icon: '⏰', description: 'Run 10 recurring quests.', check: (s) => s.recurringQuests >= 10 },

  // ── Personalization ───────────────────────────────────────────────────────
  { key: 'icons-5', name: 'Aesthetic', icon: '✨', description: 'Give 5 quests icons.', check: (s) => s.questsWithIcon >= 5 },
  { key: 'icons-10', name: 'Curator', icon: '🖼️', description: 'Give 10 quests icons.', check: (s) => s.questsWithIcon >= 10 },
  { key: 'desc-5', name: 'Storyteller', icon: '✍️', description: 'Describe 5 quests.', check: (s) => s.questsWithDescription >= 5 },
  { key: 'long-title', name: 'Wordy', icon: '🗣️', description: 'Name a quest with 40+ characters.', check: (s) => s.longestTitleLength >= 40 },

  // ── State / variety ───────────────────────────────────────────────────────
  { key: 'three-states', name: 'Master Multitasker', icon: '🤹', description: 'Have accepted, in-progress, and completed quests at once.', check: (s) => s.acceptedQuests >= 1 && s.inProgressQuests >= 1 && s.completedQuests >= 1 },
  { key: 'in-progress-5', name: 'Spinning Plates', icon: '🍽️', description: 'Have 5 quests in progress at once.', check: (s) => s.inProgressQuests >= 5 },
  { key: 'backlog-10', name: 'Someday, Maybe', icon: '🛋️', description: 'Sit on 10 untouched quests.', check: (s) => s.acceptedQuests >= 10 },
  { key: 'half-done', name: 'Halfway There', icon: '🌗', description: 'Complete half of your quests (5+ total).', check: (s) => s.totalQuests >= 5 && s.completedQuests * 2 >= s.totalQuests },
  { key: 'clean-sweep', name: 'Clean Sweep', icon: '🧹', description: 'Complete every quest you have (5+ total).', check: (s) => s.totalQuests >= 5 && s.completedQuests === s.totalQuests },

  // ── Big mixed milestones ──────────────────────────────────────────────────
  { key: 'well-rounded', name: 'Well-Rounded', icon: '🎖️', description: 'Use objectives, inventory, icons, and scheduling.', check: (s) => s.totalObjectives >= 1 && s.totalItems >= 1 && s.questsWithIcon >= 1 && s.scheduledQuests >= 1 },
  { key: 'productive-day', name: 'Productive', icon: '🚀', description: 'Complete 10 quests with 25 objectives checked.', check: (s) => s.completedQuests >= 10 && s.completedObjectives >= 25 },
  { key: 'overachiever', name: 'Overachiever', icon: '🏆', description: 'Complete 25 quests AND gather 25 items.', check: (s) => s.completedQuests >= 25 && s.gatheredItems >= 25 },
  { key: 'living-the-dream', name: 'Living The Dream', icon: '🦄', description: 'Complete 50 quests, gather 50 items, run 5 recurring quests.', check: (s) => s.completedQuests >= 50 && s.gatheredItems >= 50 && s.recurringQuests >= 5 },

  // ── Epic quests ────────────────────────────────────────────────────────────
  { key: 'first-epic', name: 'Epic Undertaking', icon: '⚔️', description: 'Create your first Epic Quest.', check: (s) => s.epicsCreated >= 1 },
  { key: 'saga', name: 'Saga', icon: '📖', description: 'Build an Epic with 5+ sub-quests.', check: (s) => s.maxSubQuests >= 5 },
  { key: 'epic-win', name: 'Epic Win', icon: '🐲', description: 'Complete an entire Epic Quest.', check: (s) => s.epicsCompleted >= 1 },

  // ── Streaks ──────────────────────────────────────────────────────────────────
  { key: 'streak-3', name: 'Warming Up', icon: '🔥', description: 'Keep a 3-day completion streak.', check: (s) => s.longestStreak >= 3 },
  { key: 'streak-7', name: 'On Fire', icon: '🔥', description: 'Keep a 7-day completion streak.', check: (s) => s.longestStreak >= 7 },
  { key: 'streak-14', name: 'Unstoppable', icon: '⚡', description: 'Keep a 14-day completion streak.', check: (s) => s.longestStreak >= 14 },
  { key: 'streak-30', name: 'Force Of Nature', icon: '🌋', description: 'Keep a 30-day completion streak.', check: (s) => s.longestStreak >= 30 },
];

/** Returns the keys of every achievement currently satisfied by the stats. */
export function earnedKeys(stats: QuestStats): string[] {
  return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.key);
}
