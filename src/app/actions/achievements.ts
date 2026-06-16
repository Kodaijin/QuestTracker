'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ACHIEVEMENTS,
  computeStats,
  earnedKeys,
  type Achievement,
} from '@/lib/achievements';
import { computeStreak, dayKey } from '@/lib/progression';

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

export type AchievementStatus = Omit<Achievement, 'check'> & {
  unlocked: boolean;
  unlockedAt: Date | null;
};

/**
 * Loads the user's quests, computes which achievements are currently earned,
 * persists any newly-earned ones, and returns the full catalog annotated with
 * unlocked state + unlock date. Achievements already unlocked stay unlocked
 * even if the underlying stat later drops.
 */
export async function getAchievements(): Promise<AchievementStatus[]> {
  const userId = await requireUserId();

  const [projects, existing, events] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      include: { objectives: true, inventoryItems: true },
    }),
    prisma.unlockedAchievement.findMany({ where: { userId } }),
    prisma.completionEvent.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);

  const stats = computeStats(projects);
  const streak = computeStreak(
    events.map((e) => dayKey(e.createdAt)),
    dayKey(new Date()),
  );
  stats.currentStreak = streak.current;
  stats.longestStreak = streak.longest;
  const earned = new Set(earnedKeys(stats));
  const unlockedMap = new Map(existing.map((u) => [u.key, u.unlockedAt]));

  // Persist newly-earned achievements that aren't recorded yet.
  const newlyEarned = [...earned].filter((key) => !unlockedMap.has(key));
  if (newlyEarned.length > 0) {
    await prisma.unlockedAchievement.createMany({
      data: newlyEarned.map((key) => ({ userId, key })),
      skipDuplicates: true,
    });
    const now = new Date();
    for (const key of newlyEarned) unlockedMap.set(key, now);
  }

  return ACHIEVEMENTS.map(({ check: _check, ...rest }) => ({
    ...rest,
    unlocked: unlockedMap.has(rest.key),
    unlockedAt: unlockedMap.get(rest.key) ?? null,
  }));
}
