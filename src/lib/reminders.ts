// The reminder sweep: for every user, derive which nudges are due, record them
// as Notification rows (deduped by a unique key), and push any freshly-created
// ones. Run periodically by the scheduler (src/instrumentation.ts).
//
// Daily nudges (inactivity, streak, pet) are gated by the user's reminderHour so
// they fire in the evening, at most once per day. Quest events (deadline,
// activation) fire as soon as they're detected, deduped per quest/day.
//
// Sweeps every user each run — fine for a small self-hosted instance. For larger
// deployments, batch or shard this.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeStreak, dayKey } from '@/lib/progression';
import { petMood } from '@/lib/pet';
import { sendPushToUser } from '@/lib/push';
import { appLink, discordConfigured, discordMention, sendDiscordMessage } from '@/lib/discord';

const INACTIVE_DAYS = 2;

const DEFAULT_PREFS = {
  enabled: true,
  inactivity: true,
  streak: true,
  deadline: true,
  pet: true,
  reminderHour: 18,
};

/** Whole-day difference between two YYYY-MM-DD keys (a - b). */
function dayDiff(a: string, b: string): number {
  const toNum = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  return toNum(a) - toNum(b);
}

/**
 * Create a notification if one with this (type, dedupeKey) doesn't already exist
 * for the user, and push it. The unique constraint makes this idempotent — a
 * duplicate create throws P2002, which we swallow (already emitted → no push).
 *
 * When `discord.username` is set and the channel is configured, the same dedupe
 * row also guards a single Discord post, so a nudge never fires twice across the
 * push and Discord channels.
 */
async function emit(
  userId: string,
  type: string,
  dedupeKey: string,
  title: string,
  body: string,
  href: string,
  discord?: { username: string | null },
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, type, dedupeKey, title, body, href } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
    throw e;
  }
  await sendPushToUser(userId, { title, body, href, tag: `${type}:${dedupeKey}` });

  if (discord?.username && discordConfigured()) {
    const link = appLink(href);
    await sendDiscordMessage(
      `${discordMention(discord.username)} **${title}** — ${body}${link ? `\n${link}` : ''}`,
    );
  }
}

export async function runReminderSweep(): Promise<void> {
  const now = new Date();
  const todayKey = dayKey(now);
  const hour = now.getHours();
  const windowMs = (Number(process.env.REMINDER_SWEEP_MINUTES ?? '15') || 15) * 60_000;

  const users = await prisma.user.findMany({
    select: { id: true, notificationPreference: true, pet: true, discordUsername: true },
  });

  for (const user of users) {
    const pref = user.notificationPreference ?? DEFAULT_PREFS;
    if (!pref.enabled) continue;

    // Whether this user gets Discord pings: opted in (handle set) + channel configured.
    const discord = user.discordUsername && discordConfigured() ? { username: user.discordUsername } : undefined;

    const events = await prisma.completionEvent.findMany({
      where: { userId: user.id },
      select: { createdAt: true },
    });
    const streak = computeStreak(events.map((e) => dayKey(e.createdAt)), todayKey);
    const daysSince = streak.lastActiveDay ? dayDiff(todayKey, streak.lastActiveDay) : null;
    const eveningReady = hour >= pref.reminderHour;

    // ── Daily nudges (evening, once/day) ──────────────────────────────────────
    if (pref.inactivity && eveningReady && daysSince != null && daysSince >= INACTIVE_DAYS) {
      await emit(
        user.id,
        'inactivity',
        `inactivity:${todayKey}`,
        'Your quests await',
        "It's been a while — jump back in and make some progress!",
        '/today',
      );
    }

    if (pref.streak && eveningReady && streak.current > 0 && streak.lastActiveDay !== todayKey) {
      await emit(
        user.id,
        'streak',
        `streak:${todayKey}`,
        '🔥 Streak at risk!',
        `Your ${streak.current}-day streak ends tonight — complete a quest to keep it alive.`,
        '/today',
      );
    }

    if (pref.pet && user.pet && eveningReady) {
      const mood = petMood(streak, todayKey);
      if (mood === 'sad' || mood === 'hungry') {
        await emit(
          user.id,
          'pet',
          `pet:${todayKey}`,
          `${user.pet.name} misses you`,
          `${user.pet.name} is ${mood} — complete a quest to cheer them up!`,
          '/hero',
        );
      }
    }

    // ── Daily Discord reminder (evening, once/day, opt-in via Discord handle) ──
    // A summary of the user's still-open quests, posted to the shared channel and
    // mentioning them. Discord-only: deduped by its own Notification row so it
    // doesn't repost across sweeps, and it skips the push channels (the nudges
    // above already cover push). Silent when the user has nothing pending.
    if (discord && eveningReady) {
      const open = await prisma.project.findMany({
        where: {
          userId: user.id,
          parentId: null,
          isEpic: false,
          OR: [{ availableAt: null }, { availableAt: { lte: now } }],
        },
        select: { title: true, objectives: { select: { isCompleted: true } } },
      });
      const pending = open.filter(
        (q) => q.objectives.length > 0 && !q.objectives.every((o) => o.isCompleted),
      );

      if (pending.length > 0) {
        try {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'discord_daily',
              dedupeKey: `discord-daily:${todayKey}`,
              title: 'Daily quest reminder',
              body: `${pending.length} quest(s) still open.`,
              href: '/today',
            },
          });

          const names = pending.slice(0, 5).map((q) => `"${q.title}"`).join(', ');
          const more = pending.length > 5 ? `, +${pending.length - 5} more` : '';
          const link = appLink('/today');
          await sendDiscordMessage(
            `🗒️ ${discordMention(discord.username)} — you have ${pending.length} quest(s) ` +
              `waiting today: ${names}${more}.${link ? `\n${link}` : ''}`,
          );
        } catch (e) {
          // Already sent today (P2002) → skip silently; anything else re-throws.
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        }
      }
    }

    // ── Quest events (as detected) ────────────────────────────────────────────
    if (pref.deadline) {
      const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dueQuests = await prisma.project.findMany({
        where: { userId: user.id, parentId: null, isEpic: false, deadline: { gte: now, lte: soon } },
        include: { objectives: { select: { isCompleted: true } } },
      });
      for (const q of dueQuests) {
        const complete = q.objectives.length > 0 && q.objectives.every((o) => o.isCompleted);
        if (!complete) {
          await emit(
            user.id,
            'deadline',
            `deadline:${q.id}:${todayKey}`,
            '⏳ Quest due soon',
            `"${q.title}" is due within 24 hours.`,
            `/projects/${q.id}`,
            discord,
          );
        }
      }

      // Quests whose availableAt crossed during this sweep window → "now active".
      const justActive = await prisma.project.findMany({
        where: {
          userId: user.id,
          availableAt: { lte: now, gte: new Date(now.getTime() - windowMs) },
        },
        select: { id: true, title: true },
      });
      for (const q of justActive) {
        await emit(
          user.id,
          'deadline',
          `activate:${q.id}`,
          'A quest is now active',
          `"${q.title}" is now available in your log.`,
          `/projects/${q.id}`,
          discord,
        );
      }
    }
  }
}
