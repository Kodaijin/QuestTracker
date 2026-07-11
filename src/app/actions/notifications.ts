'use server';

import { getServerSession } from 'next-auth';
import { z } from 'zod';
import type { Notification } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

export type NotificationActionResult = { ok: true } | { ok: false; error: string };

// ── Push subscription ───────────────────────────────────────────────────────

/** The VAPID public key, served at runtime so the client can subscribe. */
export async function getVapidPublicKey(): Promise<string | null> {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

const saveSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<NotificationActionResult> {
  const parsed = saveSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid subscription' };
  }
  const userId = await requireUserId();
  const { endpoint, p256dh, auth } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth },
    update: { userId, p256dh, auth },
  });
  return { ok: true };
}

export async function deletePushSubscription(input: {
  endpoint: string;
}): Promise<NotificationActionResult> {
  const userId = await requireUserId();
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint: input.endpoint } });
  return { ok: true };
}

// ── Native (FCM) device tokens ──────────────────────────────────────────────

const saveDeviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.string().min(1).optional(),
});

/** Register (or re-associate) an FCM device token from the Capacitor app. */
export async function saveDeviceToken(input: {
  token: string;
  platform?: string;
}): Promise<NotificationActionResult> {
  const parsed = saveDeviceTokenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid token' };
  }
  const userId = await requireUserId();
  const { token, platform } = parsed.data;

  await prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform: platform ?? 'android' },
    update: { userId },
  });
  // Visible in the server logs so device registration can be confirmed end-to-end.
  console.log(
    `[push] device token saved for user ${userId} (${platform ?? 'android'}, …${token.slice(-8)})`,
  );
  return { ok: true };
}

export async function deleteDeviceToken(input: { token: string }): Promise<NotificationActionResult> {
  const userId = await requireUserId();
  await prisma.deviceToken.deleteMany({ where: { userId, token: input.token } });
  return { ok: true };
}

// ── In-app notification center ──────────────────────────────────────────────

export async function listNotifications(): Promise<Notification[]> {
  const userId = await requireUserId();
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getUnreadNotificationCount(): Promise<number> {
  const userId = await requireUserId();
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(input: { id: string }): Promise<NotificationActionResult> {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { id: input.id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

// ── Preferences ─────────────────────────────────────────────────────────────

export interface NotificationPrefs {
  enabled: boolean;
  inactivity: boolean;
  streak: boolean;
  deadline: boolean;
  pet: boolean;
  reminderHour: number;
  resetHour: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  inactivity: true,
  streak: true,
  deadline: true,
  pet: true,
  reminderHour: 18,
  resetHour: 4,
};

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  const userId = await requireUserId();
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!pref) return { ...DEFAULT_PREFS };
  return {
    enabled: pref.enabled,
    inactivity: pref.inactivity,
    streak: pref.streak,
    deadline: pref.deadline,
    pet: pref.pet,
    reminderHour: pref.reminderHour,
    resetHour: pref.resetHour,
  };
}

const savePrefsSchema = z.object({
  enabled: z.boolean(),
  inactivity: z.boolean(),
  streak: z.boolean(),
  deadline: z.boolean(),
  pet: z.boolean(),
  reminderHour: z.number().int().min(0).max(23),
  resetHour: z.number().int().min(0).max(23),
});

export async function saveNotificationPreferences(
  input: NotificationPrefs,
): Promise<NotificationActionResult> {
  const parsed = savePrefsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const userId = await requireUserId();
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });
  return { ok: true };
}
