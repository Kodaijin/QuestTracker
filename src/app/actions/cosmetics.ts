'use server';

import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProgression } from '@/app/actions/progression';
import {
  getCosmetic,
  earnedGems,
  spentGems,
  type CosmeticCategory,
  type EquippedCosmetics,
} from '@/lib/cosmetics';

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

export interface CosmeticsState {
  balance: number;
  earned: number;
  spent: number;
  ownedIds: string[];
  equipped: EquippedCosmetics;
}

export type CosmeticsResult =
  | { ok: true; state: CosmeticsState }
  | { ok: false; error: string };

/** Maps a cosmetic category to the User column that stores the equipped id. */
const CATEGORY_COLUMN: Record<
  CosmeticCategory,
  'themeId' | 'xpBarId' | 'frameId' | 'particleId' | 'backgroundId'
> = {
  theme: 'themeId',
  xpbar: 'xpBarId',
  frame: 'frameId',
  particle: 'particleId',
  background: 'backgroundId',
};

async function buildState(userId: string): Promise<CosmeticsState> {
  const [progression, achievementsUnlocked, owned, user] = await Promise.all([
    getProgression(),
    prisma.unlockedAchievement.count({ where: { userId } }),
    prisma.cosmeticUnlock.findMany({ where: { userId }, select: { cosmeticId: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { themeId: true, xpBarId: true, frameId: true, particleId: true, backgroundId: true },
    }),
  ]);

  const ownedIds = owned.map((o) => o.cosmeticId);
  const earned = earnedGems({
    level: progression.level,
    achievementsUnlocked,
    longestStreak: progression.streak.longest,
  });
  const spent = spentGems(ownedIds);

  return {
    balance: earned - spent,
    earned,
    spent,
    ownedIds,
    equipped: {
      theme: user?.themeId ?? null,
      xpbar: user?.xpBarId ?? null,
      frame: user?.frameId ?? null,
      particle: user?.particleId ?? null,
      background: user?.backgroundId ?? null,
    },
  };
}

export async function getCosmeticsState(): Promise<CosmeticsState> {
  const userId = await requireUserId();
  return buildState(userId);
}

export async function purchaseCosmetic(input: { cosmeticId: string }): Promise<CosmeticsResult> {
  const parsed = z.object({ cosmeticId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const cosmetic = getCosmetic(parsed.data.cosmeticId);
  if (!cosmetic) return { ok: false, error: 'Unknown cosmetic.' };

  const userId = await requireUserId();
  const state = await buildState(userId);

  if (state.ownedIds.includes(cosmetic.id)) {
    return { ok: false, error: 'You already own this.' };
  }
  if (state.balance < cosmetic.price) {
    return { ok: false, error: `Not enough gems — need ${cosmetic.price}, you have ${state.balance}.` };
  }

  try {
    await prisma.cosmeticUnlock.create({ data: { userId, cosmeticId: cosmetic.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'You already own this.' };
    }
    throw e;
  }

  return { ok: true, state: await buildState(userId) };
}

const equipSchema = z.object({
  category: z.enum(['theme', 'xpbar', 'frame', 'particle', 'background']),
  // null unequips (back to the default look).
  cosmeticId: z.string().min(1).nullable(),
});

export async function equipCosmetic(input: {
  category: CosmeticCategory;
  cosmeticId: string | null;
}): Promise<CosmeticsResult> {
  const parsed = equipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { category, cosmeticId } = parsed.data;
  const userId = await requireUserId();

  if (cosmeticId !== null) {
    const cosmetic = getCosmetic(cosmeticId);
    if (!cosmetic || cosmetic.category !== category) {
      return { ok: false, error: 'Unknown cosmetic.' };
    }
    // Free cosmetics (e.g. default backgrounds) can be equipped without a purchase.
    if (!cosmetic.free) {
      const owned = await prisma.cosmeticUnlock.findUnique({
        where: { userId_cosmeticId: { userId, cosmeticId } },
        select: { id: true },
      });
      if (!owned) return { ok: false, error: "You don't own this yet." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { [CATEGORY_COLUMN[category]]: cosmeticId },
  });

  return { ok: true, state: await buildState(userId) };
}
