'use server';

// Note: these actions have no rate limiting — acceptable for a self-hosted
// single-user app; rate limiting is out of scope here.

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { USERNAME_REGEX } from '@/lib/username';

// ── Session guard ─────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

// ── Return types ──────────────────────────────────────────────────────────────

export type AccountActionResult = { ok: true } | { ok: false; error: string };

// ── Schemas ───────────────────────────────────────────────────────────────────

const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newEmail: z.string().email('Invalid email address'),
});

const changeUsernameSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newUsername: z
    .string()
    .trim()
    .regex(USERNAME_REGEX, 'Username must be 3–20 letters, numbers, or underscores'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const changeSecurityQuestionSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  securityQuestion: z.string().trim().min(1, 'Security question is required').max(200),
  securityAnswer: z.string().min(1, 'Security answer is required'),
});

// Low-stakes profile field (like a notification preference) — no password needed.
// An empty value clears the handle (opts the user out of Discord notifications).
const changeDiscordUsernameSchema = z.object({
  discordUsername: z.string().trim().max(64),
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function changeEmail(input: {
  currentPassword: string;
  newEmail: string;
}): Promise<AccountActionResult> {
  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { currentPassword, newEmail } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true },
  });

  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const normalizedEmail = newEmail.toLowerCase();

  if (normalizedEmail === user.email.toLowerCase()) {
    return { ok: false, error: 'That is already your email.' };
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, error: 'An account with that email already exists.' };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { email: normalizedEmail },
    });
    return { ok: true };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return { ok: false, error: 'An account with that email already exists.' };
    }
    throw e;
  }
}

export async function changeUsername(input: {
  currentPassword: string;
  newUsername: string;
}): Promise<AccountActionResult> {
  const parsed = changeUsernameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { currentPassword, newUsername } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, passwordHash: true },
  });

  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const normalizedUsername = newUsername.toLowerCase();

  if (normalizedUsername === user.username?.toLowerCase()) {
    return { ok: false, error: 'That is already your username.' };
  }

  const existing = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, error: 'That username is already taken.' };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username: normalizedUsername },
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'That username is already taken.' };
    }
    throw e;
  }
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AccountActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsOld) {
    return { ok: false, error: 'New password must be different.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { ok: true };
}

export async function changeSecurityQuestion(input: {
  currentPassword: string;
  securityQuestion: string;
  securityAnswer: string;
}): Promise<AccountActionResult> {
  const parsed = changeSecurityQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { currentPassword, securityQuestion, securityAnswer } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const normalizedAnswer = securityAnswer.trim().toLowerCase();
  const securityAnswerHash = await bcrypt.hash(normalizedAnswer, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      securityQuestion: securityQuestion.trim(),
      securityAnswerHash,
    },
  });

  return { ok: true };
}

export async function changeDiscordUsername(input: {
  discordUsername: string;
}): Promise<AccountActionResult> {
  const parsed = changeDiscordUsernameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const trimmed = parsed.data.discordUsername.trim();

  await prisma.user.update({
    where: { id: userId },
    data: { discordUsername: trimmed || null },
  });

  return { ok: true };
}
