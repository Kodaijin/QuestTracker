// Bot-facing quest API. Lets the containerized Discord bot (see bot/) create and
// list quests on a user's behalf, authenticated by a shared secret rather than a
// user session. Identity is resolved from the caller-supplied Discord user id via
// the User.discordUsername field (the same handle used for webhook @mentions).
//
// Not part of the app's normal Server-Action surface — this is the one HTTP entry
// point the external bot is allowed to call.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createProjectForUser } from '@/app/actions/projects';

// Prisma requires the Node.js runtime (not Edge).
export const runtime = 'nodejs';

/** Constant-time comparison of the bearer token against BOT_API_SECRET. */
function authorized(req: Request): boolean {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false; // unset secret = endpoint disabled, never open

  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Find the app user linked to a Discord numeric id (stored in discordUsername). */
async function userForDiscordId(discordUserId: string) {
  return prisma.user.findFirst({
    where: { discordUsername: discordUserId.trim() },
    select: { id: true },
  });
}

const NOT_LINKED =
  "No QuestTracker account is linked to your Discord ID. Add your numeric Discord ID under Settings → Discord, then try again.";

/**
 * POST /api/bot/quests
 * Body: { discordUserId: string, quest: { title, description?, difficulty?,
 *         objectives?, inventoryItems?, tags?, ... } }
 * Creates a quest owned by the linked user. Deep validation is delegated to
 * createProjectForUser (the same createProjectSchema the UI uses).
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { discordUserId?: unknown; quest?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const discordUserId = body.discordUserId;
  if (typeof discordUserId !== 'string' || discordUserId.trim() === '') {
    return NextResponse.json({ error: 'discordUserId is required' }, { status: 400 });
  }
  if (typeof body.quest !== 'object' || body.quest === null) {
    return NextResponse.json({ error: 'quest is required' }, { status: 400 });
  }

  const user = await userForDiscordId(discordUserId);
  if (!user) {
    return NextResponse.json({ error: NOT_LINKED }, { status: 404 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = await createProjectForUser(user.id, body.quest as any);
    return NextResponse.json({ id: project.id, title: project.title }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create quest';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * GET /api/bot/quests?discordUserId=...
 * Lists the linked user's open (incomplete, currently-available) top-level quests,
 * so a /quests slash command can show status.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordUserId = new URL(req.url).searchParams.get('discordUserId');
  if (!discordUserId || discordUserId.trim() === '') {
    return NextResponse.json({ error: 'discordUserId is required' }, { status: 400 });
  }

  const user = await userForDiscordId(discordUserId);
  if (!user) {
    return NextResponse.json({ error: NOT_LINKED }, { status: 404 });
  }

  const now = new Date();
  const quests = await prisma.project.findMany({
    where: {
      userId: user.id,
      parentId: null,
      isEpic: false,
      OR: [{ availableAt: null }, { availableAt: { lte: now } }],
    },
    select: { id: true, title: true, objectives: { select: { isCompleted: true } } },
  });
  const open = quests
    .filter((q) => q.objectives.length > 0 && !q.objectives.every((o) => o.isCompleted))
    .map((q) => ({ id: q.id, title: q.title }));

  return NextResponse.json({ quests: open }, { status: 200 });
}
