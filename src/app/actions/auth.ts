'use server';

// Note: these actions have no rate limiting — acceptable for a self-hosted
// single-user app; rate limiting is out of scope here.

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { USERNAME_REGEX } from '@/lib/username';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z
    .string()
    .trim()
    .regex(USERNAME_REGEX, 'Username must be 3–20 letters, numbers, or underscores'),
  name: z.string().optional(),
  securityQuestion: z
    .string()
    .trim()
    .min(1, 'Security question is required')
    .max(200),
  securityAnswer: z.string().min(1, 'Security answer is required'),
});

type RegisterInput = z.infer<typeof registerSchema>;

type SafeUser = { id: string; email: string; name: string | null };

export type RegisterResult =
  | { ok: true; user: SafeUser }
  | { ok: false; error: string };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { email, password, username, name, securityQuestion, securityAnswer } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const normalizedUsername = username.toLowerCase();
  const trimmedName = name?.trim() || undefined;

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, error: 'An account with that email already exists.' };
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  });

  if (existingUsername) {
    return { ok: false, error: 'That username is already taken.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedAnswer = securityAnswer.trim().toLowerCase();
  const securityAnswerHash = await bcrypt.hash(normalizedAnswer, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        name: trimmedName ?? null,
        securityQuestion: securityQuestion.trim(),
        securityAnswerHash,
      },
      select: { id: true, email: true, name: true },
    });

    return { ok: true, user };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const target = e.meta?.target;
      const isUsername = Array.isArray(target)
        ? target.includes('username')
        : String(target ?? '').includes('username');
      return {
        ok: false,
        error: isUsername
          ? 'That username is already taken.'
          : 'An account with that email already exists.',
      };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Password recovery
// ---------------------------------------------------------------------------

export type GetSecurityQuestionResult =
  | { ok: true; question: string }
  | { ok: false; error: string };

export async function getSecurityQuestion(
  email: string,
): Promise<GetSecurityQuestionResult> {
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { securityQuestion: true },
  });

  if (!user || !user.securityQuestion) {
    return { ok: false, error: 'No recovery question is available for that email.' };
  }

  return { ok: true, question: user.securityQuestion };
}

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  answer: z.string().min(1, 'Answer is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ResetPasswordResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordWithAnswer(input: {
  email: string;
  answer: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { email, answer, newPassword } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, securityAnswerHash: true },
  });

  if (!user || !user.securityAnswerHash) {
    return { ok: false, error: 'Unable to reset password.' };
  }

  const normalizedAnswer = answer.trim().toLowerCase();
  const answerMatches = await bcrypt.compare(normalizedAnswer, user.securityAnswerHash);

  if (!answerMatches) {
    return { ok: false, error: 'Incorrect answer to the security question.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { ok: true };
}
