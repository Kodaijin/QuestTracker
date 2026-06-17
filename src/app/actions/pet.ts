'use server';

import { getServerSession } from 'next-auth';
import { z } from 'zod';
import type { Pet } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProgression } from '@/app/actions/progression';
import { dayKey } from '@/lib/progression';
import { PET_SPECIES_IDS, petStage, petMood, type PetStage, type PetMood } from '@/lib/pet';

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

export async function getPet(): Promise<Pet | null> {
  const userId = await requireUserId();
  return prisma.pet.findUnique({ where: { userId } });
}

export interface PetStatus {
  name: string;
  species: string;
  level: number;
  stage: PetStage;
  mood: PetMood;
}

/**
 * The pet's full derived status (or null if not yet adopted). Stage and mood are
 * computed server-side so day boundaries use the server timezone — consistent
 * with progression/streaks.
 */
export async function getPetStatus(): Promise<PetStatus | null> {
  const userId = await requireUserId();
  const pet = await prisma.pet.findUnique({ where: { userId } });
  if (!pet) return null;

  const progression = await getProgression();
  return {
    name: pet.name,
    species: pet.species,
    level: progression.level,
    stage: petStage(progression.level, pet.species),
    mood: petMood(progression.streak, dayKey(new Date())),
  };
}

const adoptPetSchema = z.object({
  name: z.string().trim().min(1, 'Give your companion a name').max(20, 'Name is too long'),
  species: z.enum(PET_SPECIES_IDS),
});

export type AdoptPetResult = { ok: true; pet: Pet } | { ok: false; error: string };

export async function adoptPet(input: {
  name: string;
  species: string;
}): Promise<AdoptPetResult> {
  const parsed = adoptPetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();

  const existing = await prisma.pet.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    return { ok: false, error: 'You already have a companion.' };
  }

  try {
    const pet = await prisma.pet.create({
      data: { userId, name: parsed.data.name, species: parsed.data.species },
    });
    return { ok: true, pet };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'You already have a companion.' };
    }
    throw e;
  }
}
