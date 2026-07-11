'use server';

// Party / social actions: hero-to-hero connections (invite by username, then
// accept/decline) and per-quest membership invites. Mirrors the session-guard
// and Zod-validation patterns used in projects.ts / account.ts.

import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { InviteStatus, Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { USERNAME_REGEX } from '@/lib/username';
import {
  appLink,
  discordConfigured,
  discordMention,
  sendDiscordEmbed,
  EmbedColors,
} from '@/lib/discord';
import { emit } from '@/lib/reminders';

// ── Session guard ───────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

/** Ids of the user's accepted connections (allies), usable as quest invitees/recipients. */
async function acceptedAllyIds(userId: string): Promise<Set<string>> {
  const connections = await prisma.connection.findMany({
    where: {
      status: InviteStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return new Set(connections.map((c) => (c.requesterId === userId ? c.addresseeId : c.requesterId)));
}

// ── Return types ──────────────────────────────────────────────────────────────

export type PartyActionResult = { ok: true } | { ok: false; error: string };

export type Ally = {
  connectionId: string;
  userId: string;
  username: string | null;
  name: string | null;
};

export type IncomingRequest = {
  connectionId: string;
  userId: string;
  username: string | null;
  name: string | null;
  createdAt: Date;
};

export type QuestInvite = {
  projectId: string;
  title: string;
  icon: string | null;
  inviterUsername: string | null;
  inviterName: string | null;
  // A "given" quest was handed to you to do (you check off, can't edit), rather
  // than a co-op quest you'd share progress on. Drives the Party-page copy.
  isGiven: boolean;
};

// ── Connections ─────────────────────────────────────────────────────────────

const sendConnectionSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(USERNAME_REGEX, 'Enter a valid username (3–20 letters, numbers, or underscores)'),
});

export async function sendConnectionRequest(input: {
  username: string;
}): Promise<PartyActionResult> {
  const parsed = sendConnectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const target = await prisma.user.findUnique({
    where: { username: parsed.data.username.toLowerCase() },
    select: { id: true },
  });

  if (!target) {
    return { ok: false, error: 'No hero found with that username.' };
  }
  if (target.id === userId) {
    return { ok: false, error: "You can't add yourself." };
  }

  // A pair may have at most one live connection in either direction.
  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === InviteStatus.ACCEPTED) {
      return { ok: false, error: 'You are already allies.' };
    }
    if (existing.status === InviteStatus.PENDING) {
      return { ok: false, error: 'There is already a pending request between you.' };
    }
    // A previously declined request can be re-sent fresh.
    await prisma.connection.delete({ where: { id: existing.id } });
  }

  try {
    await prisma.connection.create({
      data: { requesterId: userId, addresseeId: target.id, status: InviteStatus.PENDING },
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'There is already a pending request between you.' };
    }
    throw e;
  }
}

const removeAllySchema = z.object({
  connectionId: z.string().min(1),
});

/**
 * Sever an accepted alliance. Removes the connection and, in both directions,
 * any quest memberships that exist purely because of it (the other hero on your
 * quests, and you on theirs), so a falling-out fully disconnects the two heroes.
 */
export async function removeAlly(input: {
  connectionId: string;
}): Promise<PartyActionResult> {
  const parsed = removeAllySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { connectionId } = parsed.data;

  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) return { ok: false, error: 'Ally not found.' };
  if (connection.requesterId !== userId && connection.addresseeId !== userId) {
    return { ok: false, error: 'Not your alliance to remove.' };
  }

  const otherId =
    connection.requesterId === userId ? connection.addresseeId : connection.requesterId;

  await prisma.$transaction([
    // The other hero's membership in quests you own.
    prisma.questMember.deleteMany({ where: { userId: otherId, project: { userId } } }),
    // Your membership in quests they own.
    prisma.questMember.deleteMany({ where: { userId, project: { userId: otherId } } }),
    prisma.connection.delete({ where: { id: connectionId } }),
  ]);

  return { ok: true };
}

const respondConnectionSchema = z.object({
  connectionId: z.string().min(1),
  accept: z.boolean(),
});

export async function respondToConnection(input: {
  connectionId: string;
  accept: boolean;
}): Promise<PartyActionResult> {
  const parsed = respondConnectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { connectionId, accept } = parsed.data;

  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) return { ok: false, error: 'Request not found.' };
  if (connection.addresseeId !== userId) return { ok: false, error: 'Not your request to answer.' };
  if (connection.status !== InviteStatus.PENDING) {
    return { ok: false, error: 'This request has already been answered.' };
  }

  await prisma.connection.update({
    where: { id: connectionId },
    data: { status: accept ? InviteStatus.ACCEPTED : InviteStatus.DECLINED },
  });
  return { ok: true };
}

export async function listConnections(): Promise<Ally[]> {
  const userId = await requireUserId();

  const connections = await prisma.connection.findMany({
    where: {
      status: InviteStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, username: true, name: true } },
      addressee: { select: { id: true, username: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return connections.map((c) => {
    const other = c.requesterId === userId ? c.addressee : c.requester;
    return {
      connectionId: c.id,
      userId: other.id,
      username: other.username,
      name: other.name,
    };
  });
}

export async function listIncomingConnectionRequests(): Promise<IncomingRequest[]> {
  const userId = await requireUserId();

  const requests = await prisma.connection.findMany({
    where: { addresseeId: userId, status: InviteStatus.PENDING },
    include: { requester: { select: { id: true, username: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map((r) => ({
    connectionId: r.id,
    userId: r.requester.id,
    username: r.requester.username,
    name: r.requester.name,
    createdAt: r.createdAt,
  }));
}

// ── Quest invites ─────────────────────────────────────────────────────────────

const inviteToQuestSchema = z.object({
  projectId: z.string().min(1),
  userIds: z.array(z.string().min(1)).max(50),
});

export async function inviteToQuest(input: {
  projectId: string;
  userIds: string[];
}): Promise<PartyActionResult> {
  const parsed = inviteToQuestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { projectId, userIds } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, isEpic: true, title: true },
  });
  if (!project) return { ok: false, error: 'Quest not found.' };
  if (project.userId !== userId) return { ok: false, error: 'Only the quest owner can invite.' };
  if (project.isEpic) return { ok: false, error: 'Epic quests cannot be shared yet.' };

  // Every invitee must be an accepted connection of the owner.
  const allyIds = await acceptedAllyIds(userId);

  const valid = userIds.filter((id) => allyIds.has(id) && id !== userId);
  if (valid.length === 0) return { ok: false, error: 'No valid allies to invite.' };

  await prisma.$transaction(
    valid.map((memberId) =>
      prisma.questMember.upsert({
        where: { projectId_userId: { projectId, userId: memberId } },
        create: { projectId, userId: memberId, status: InviteStatus.PENDING },
        update: {}, // leave an existing invite/membership untouched
      }),
    ),
  );

  // Ping freshly invited members in the shared Discord channel. Best-effort; a
  // webhook failure must not fail the invite.
  if (discordConfigured()) {
    try {
      const members = await prisma.user.findMany({
        where: { id: { in: valid } },
        select: { discordUsername: true },
      });
      const mentions = members.map((m) => discordMention(m.discordUsername)).filter(Boolean);
      if (mentions.length > 0) {
        const link = appLink(`/projects/${projectId}`);
        await sendDiscordEmbed(
          {
            title: '📜 Quest Invitation',
            description: `You've been invited to the quest **${project.title}**!`,
            url: link || undefined,
            color: EmbedColors.INVITE,
            timestamp: new Date().toISOString(),
          },
          mentions.join(' '),
        );
      }
    } catch {
      /* ignore — Discord is a non-critical side channel */
    }
  }

  return { ok: true };
}

const giveQuestSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * Hand a quest you built to a single ally to *do*. Unlike a co-op share, the
 * recipient works the quest but can't edit it (membersCanEdit is forced off) while
 * you keep edit rights and watch their progress; XP is split (recipient full, you
 * half — see acceptedParticipants in projects.ts). The recipient accepts/declines
 * on their Party page via respondToQuestInvite, exactly like a co-op invite.
 */
export async function giveQuest(input: {
  projectId: string;
  userId: string;
}): Promise<PartyActionResult> {
  const parsed = giveQuestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const giverId = await requireUserId();
  const { projectId, userId: recipientId } = parsed.data;

  if (recipientId === giverId) {
    return { ok: false, error: "You can't give a quest to yourself." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      isEpic: true,
      title: true,
      members: { select: { status: true } },
      user: { select: { username: true, name: true } },
    },
  });
  if (!project) return { ok: false, error: 'Quest not found.' };
  if (project.userId !== giverId) {
    return { ok: false, error: 'Only the quest owner can give it away.' };
  }
  if (project.isEpic) return { ok: false, error: 'Epic quests cannot be given.' };
  // Already handed to / shared with someone who hasn't declined.
  if (project.members.some((m) => m.status !== InviteStatus.DECLINED)) {
    return { ok: false, error: 'This quest is already shared or given to someone.' };
  }

  // The recipient must be an accepted ally.
  const allyIds = await acceptedAllyIds(giverId);
  if (!allyIds.has(recipientId)) {
    return { ok: false, error: 'You can only give quests to your allies.' };
  }

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { isGiven: true, membersCanEdit: false },
    }),
    prisma.questMember.upsert({
      where: { projectId_userId: { projectId, userId: recipientId } },
      create: { projectId, userId: recipientId, status: InviteStatus.PENDING },
      update: { status: InviteStatus.PENDING }, // reset a prior decline so it can be re-offered
    }),
  ]);

  // Notify the recipient: in-app alert + push (+ Discord if configured). The alert
  // links to /party, where they can accept it (they can't open the quest until they do).
  const giverName = project.user.username ?? project.user.name ?? 'An ally';
  const dedupeKey = `gift:${projectId}:${recipientId}`;
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { discordUsername: true },
  });
  try {
    // Clear any prior gift alert for this pair so a re-give (after a decline) fires
    // a fresh notification instead of being swallowed by emit's dedupe.
    await prisma.notification.deleteMany({
      where: { userId: recipientId, type: 'gift', dedupeKey },
    });
    await emit(
      recipientId,
      'gift',
      dedupeKey,
      '🎁 A quest for you',
      `${giverName} gave you the quest "${project.title}". Accept it on your Party page to take it on.`,
      '/party',
      { username: recipient?.discordUsername ?? null },
      EmbedColors.INVITE,
    );
  } catch {
    /* ignore — notification/push is a best-effort side channel */
  }

  return { ok: true };
}

const respondQuestInviteSchema = z.object({
  projectId: z.string().min(1),
  accept: z.boolean(),
});

export async function respondToQuestInvite(input: {
  projectId: string;
  accept: boolean;
}): Promise<PartyActionResult> {
  const parsed = respondQuestInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { projectId, accept } = parsed.data;

  const membership = await prisma.questMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) return { ok: false, error: 'Invite not found.' };
  if (membership.status !== InviteStatus.PENDING) {
    return { ok: false, error: 'This invite has already been answered.' };
  }

  await prisma.questMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { status: accept ? InviteStatus.ACCEPTED : InviteStatus.DECLINED },
  });
  return { ok: true };
}

const leaveQuestSchema = z.object({
  projectId: z.string().min(1),
});

/**
 * Leave a shared quest you were invited to (pending or accepted). Removes your
 * QuestMember row only — the quest stays for its owner and other members, and any
 * XP you already earned from it is untouched (it lives in the CompletionEvent log).
 * The owner can't leave their own quest; they delete it instead.
 */
export async function leaveQuest(input: {
  projectId: string;
}): Promise<PartyActionResult> {
  const parsed = leaveQuestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = await requireUserId();
  const { projectId } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return { ok: false, error: 'Quest not found.' };
  if (project.userId === userId) {
    return { ok: false, error: 'You own this quest — delete it instead of leaving.' };
  }

  const membership = await prisma.questMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) return { ok: false, error: 'You are not a member of this quest.' };

  await prisma.questMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  return { ok: true };
}

export async function listQuestInvites(): Promise<QuestInvite[]> {
  const userId = await requireUserId();

  const invites = await prisma.questMember.findMany({
    where: { userId, status: InviteStatus.PENDING },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          icon: true,
          isGiven: true,
          user: { select: { username: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return invites.map((i) => ({
    projectId: i.project.id,
    title: i.project.title,
    icon: i.project.icon,
    inviterUsername: i.project.user.username,
    inviterName: i.project.user.name,
    isGiven: i.project.isGiven,
  }));
}

// ── Notice badge ──────────────────────────────────────────────────────────────

/** Total pending items needing the user's attention (connection requests + quest invites). */
export async function getPendingNoticeCount(): Promise<number> {
  const userId = await requireUserId();

  const [requests, invites] = await Promise.all([
    prisma.connection.count({ where: { addresseeId: userId, status: InviteStatus.PENDING } }),
    prisma.questMember.count({ where: { userId, status: InviteStatus.PENDING } }),
  ]);

  return requests + invites;
}
