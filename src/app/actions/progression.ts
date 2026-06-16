'use server';

import { getServerSession } from 'next-auth';
import { CompletionType, Difficulty } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  computeStreak,
  dayKey,
  levelForXp,
  titleForLevel,
  type LevelInfo,
  type StreakInfo,
} from '@/lib/progression';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { isQuestComplete } from '@/lib/quest';
import { difficultyMeta } from '@/lib/difficulty';

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

export interface Progression extends LevelInfo {
  title: string;
  streak: StreakInfo;
}

/**
 * The player's current progression: level, XP-into-level, rank title, and
 * streak — all derived from the CompletionEvent log (the source of truth).
 *
 * Day boundaries use the server's local timezone (TZ env), consistent with the
 * recurrence / missed-quest logic.
 */
export async function getProgression(): Promise<Progression> {
  const userId = await requireUserId();

  const events = await prisma.completionEvent.findMany({
    where: { userId },
    select: { xp: true, createdAt: true },
  });

  const totalXp = events.reduce((sum, e) => sum + e.xp, 0);
  const levelInfo = levelForXp(totalXp);
  const streak = computeStreak(
    events.map((e) => dayKey(e.createdAt)),
    dayKey(new Date()),
  );

  return { ...levelInfo, title: titleForLevel(levelInfo.level), streak };
}

// ── Insights ──────────────────────────────────────────────────────────────────

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  count: number;
  xp: number;
}

export interface DifficultyBreakdown {
  difficulty: Difficulty;
  label: string;
  emoji: string;
  total: number;
  completed: number;
}

export interface Insights {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  byType: Record<CompletionType, number>;
  daily: DailyPoint[]; // last `days` days, ascending
  days: number;
  questsByDifficulty: DifficultyBreakdown[];
  achievementsUnlocked: number;
  achievementsTotal: number;
}

const INSIGHT_DAYS = 119; // 17 weeks for the contribution heatmap

/** Aggregates the CompletionEvent log + current quests into chart-ready data. */
export async function getInsights(): Promise<Insights> {
  const userId = await requireUserId();

  const [events, projects, achievementCount] = await Promise.all([
    prisma.completionEvent.findMany({
      where: { userId },
      select: { xp: true, type: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { userId },
      include: { objectives: true, inventoryItems: true },
    }),
    prisma.unlockedAchievement.count({ where: { userId } }),
  ]);

  const totalXp = events.reduce((sum, e) => sum + e.xp, 0);
  const level = levelForXp(totalXp).level;
  const streak = computeStreak(
    events.map((e) => dayKey(e.createdAt)),
    dayKey(new Date()),
  );

  const byType: Record<CompletionType, number> = {
    [CompletionType.OBJECTIVE]: 0,
    [CompletionType.QUEST]: 0,
    [CompletionType.ITEM]: 0,
  };
  for (const e of events) byType[e.type] += 1;

  // Daily series for the last INSIGHT_DAYS days (ascending, gaps filled with 0).
  const buckets = new Map<string, { count: number; xp: number }>();
  for (const e of events) {
    const key = dayKey(e.createdAt);
    const b = buckets.get(key) ?? { count: 0, xp: 0 };
    b.count += 1;
    b.xp += e.xp;
    buckets.set(key, b);
  }
  const daily: DailyPoint[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (INSIGHT_DAYS - 1));
  for (let i = 0; i < INSIGHT_DAYS; i++) {
    const key = dayKey(cursor);
    const b = buckets.get(key);
    daily.push({ day: key, count: b?.count ?? 0, xp: b?.xp ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Current portfolio of quests grouped by difficulty (top-level only).
  const byDiff = new Map<Difficulty, { total: number; completed: number }>();
  for (const p of projects) {
    if (p.parentId != null) continue;
    const entry = byDiff.get(p.difficulty) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (isQuestComplete(p, projects)) entry.completed += 1;
    byDiff.set(p.difficulty, entry);
  }
  const questsByDifficulty: DifficultyBreakdown[] = (
    Object.values(Difficulty) as Difficulty[]
  ).map((d) => {
    const meta = difficultyMeta(d);
    const entry = byDiff.get(d) ?? { total: 0, completed: 0 };
    return { difficulty: d, label: meta.label, emoji: meta.emoji, ...entry };
  });

  return {
    totalXp,
    level,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    byType,
    daily,
    days: INSIGHT_DAYS,
    questsByDifficulty,
    achievementsUnlocked: achievementCount,
    achievementsTotal: ACHIEVEMENTS.length,
  };
}
