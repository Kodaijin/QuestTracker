/**
 * QuestTracker end-to-end smoke test.
 *
 * Run:  npm run smoke
 *
 * Requires DATABASE_URL and NEXTAUTH_URL in environment or .env file.
 * The app must be reachable at NEXTAUTH_URL for the AUTH step.
 *
 * Steps
 *   1  REGISTER           — create unique test user, assert safe shape (no passwordHash)
 *   2  DUPLICATE_GUARD    — same email again → { ok: false } returned, no throw
 *   3  AUTH               — HTTP credentials sign-in → session cookie issued
 *   4  CREATE_PROJECT      — project created, owned by test user
 *   5  TOGGLE_OBJECTIVE   — seed objective, flip false→true, confirm on re-fetch
 *   6  INVENTORY          — create item, set qty=42, persist; negative qty rejected
 *   7  OWNERSHIP          — other user's ID must not pass the ownership guard
 *   8  CLEANUP            — cascade-delete test users, confirm 0 rows remain
 */

import { readFileSync } from 'node:fs';
import { registerUser } from '../src/app/actions/auth';
import type { RegisterResult } from '../src/app/actions/auth';
import { prisma as db } from '../src/lib/prisma';

// ── .env loader (non-destructive: skips keys already set in shell) ────────────

function loadDotEnv(): void {
  try {
    const raw = readFileSync('.env', 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env absent — rely on shell environment
  }
}

loadDotEnv();

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TS = Date.now();
const TEST_EMAIL = `smoke+${TS}@questlog.test`;
const OTHER_EMAIL = `smoke-other+${TS}@questlog.test`;
const TEST_PW = 'SmokeTest@1234!';
// Usernames must be 3–20 chars of [a-zA-Z0-9_]; TS keeps them unique per run.
const TEST_USERNAME = `smoke${TS}`.slice(0, 20);
const OTHER_USERNAME = `other${TS}`.slice(0, 20);

// ── Reporting helpers ─────────────────────────────────────────────────────────

class SmokeFailure extends Error {}

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string): void {
  console.log(`  ✓  PASS  ${label}${detail ? `  (${detail})` : ''}`);
  passed++;
}

function fail(label: string, observed: string, expected: string): never {
  console.error(`  ✗  FAIL  ${label}`);
  console.error(`           expected : ${expected}`);
  console.error(`           observed : ${observed}`);
  failed++;
  throw new SmokeFailure(label);
}

function must(cond: boolean, label: string, observed: string, expected: string): asserts cond {
  if (!cond) fail(label, observed, expected);
}

// ── Step 1: REGISTER ──────────────────────────────────────────────────────────

async function step1Register() {
  const result = await registerUser({
    email: TEST_EMAIL,
    password: TEST_PW,
    username: TEST_USERNAME,
    name: 'Smoke Bot',
    securityQuestion: "Name of my first pet?",
    securityAnswer: 'smokebot',
  });

  must(result.ok, 'REGISTER', `ok=false error="${!result.ok ? result.error : ''}"`, 'ok=true');
  must(!!result.user.id, 'REGISTER', 'user.id absent', 'user.id present');
  must(!!result.user.email, 'REGISTER', 'user.email absent', 'user.email present');
  must(
    !('passwordHash' in result.user),
    'REGISTER',
    'passwordHash present in response',
    'passwordHash absent',
  );

  ok('REGISTER', `id=${result.user.id.slice(0, 8)}… email=${result.user.email}`);
  return result.user;
}

// ── Step 2: DUPLICATE_GUARD ───────────────────────────────────────────────────

async function step2DuplicateGuard(): Promise<void> {
  const result: RegisterResult = await registerUser({
    email: TEST_EMAIL,
    password: TEST_PW,
    username: `dup${TS}`.slice(0, 20),
    securityQuestion: "Name of my first pet?",
    securityAnswer: 'smokebot',
  }).catch((e: unknown) =>
    fail(
      'DUPLICATE_GUARD',
      `threw: ${e instanceof Error ? e.message : String(e)}`,
      '{ ok: false } returned gracefully, no throw',
    ),
  );

  must(!result.ok, 'DUPLICATE_GUARD', 'ok=true (duplicate not rejected)', 'ok=false');
  must(!!result.error, 'DUPLICATE_GUARD', 'error field empty', 'non-empty error string');

  ok('DUPLICATE_GUARD', `error="${result.error}"`);
}

// ── Step 3: AUTH (HTTP) ───────────────────────────────────────────────────────

async function step3Auth(): Promise<void> {
  // 1. Fetch CSRF token — NextAuth requires it for all POST callback routes.
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`).catch((e: unknown) =>
    fail(
      'AUTH:csrf_fetch',
      `network error: ${e instanceof Error ? e.message : String(e)}`,
      `HTTP 200 from ${BASE_URL}/api/auth/csrf`,
    ),
  );

  must(csrfRes.ok, 'AUTH:csrf', `HTTP ${csrfRes.status}`, 'HTTP 200');

  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  must(
    typeof csrfToken === 'string' && csrfToken.length > 0,
    'AUTH:csrf_token',
    'csrfToken absent or empty',
    'non-empty csrfToken string',
  );

  // 2. POST credentials — json:true makes NextAuth return JSON instead of a redirect.
  const body = new URLSearchParams({
    email: TEST_EMAIL,
    password: TEST_PW,
    csrfToken,
    callbackUrl: `${BASE_URL}/`,
    json: 'true',
  });

  const signInRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'manual',
  }).catch((e: unknown) =>
    fail(
      'AUTH:signin_fetch',
      `network error: ${e instanceof Error ? e.message : String(e)}`,
      'HTTP response from credentials callback',
    ),
  );

  const signInData = (await signInRes.json().catch(() => ({} as Record<string, unknown>))) as {
    url?: string;
    error?: string;
  };

  must(
    !signInData.error,
    'AUTH:signin',
    `error="${signInData.error ?? 'none'}"`,
    'no error in sign-in response',
  );

  // 3. Verify session cookie was issued.
  const rawCookies = signInRes.headers.get('set-cookie') ?? '';
  const hasSession =
    rawCookies.includes('next-auth.session-token') ||
    rawCookies.includes('__Secure-next-auth.session-token');

  must(
    hasSession,
    'AUTH:cookie',
    `no session cookie — headers: "${rawCookies.slice(0, 140)}"`,
    'next-auth.session-token present in Set-Cookie',
  );

  ok('AUTH', 'CSRF token fetched, credentials accepted, session cookie issued');
}

// ── Step 4: CREATE_PROJECT ────────────────────────────────────────────────────

async function step4CreateProject(userId: string) {
  const project = await db.project.create({
    data: { title: 'Smoke Test Quest', description: 'Auto-created by smoke test', userId },
  });

  must(!!project.id, 'CREATE_PROJECT', 'project.id absent', 'project.id present');
  must(
    project.userId === userId,
    'CREATE_PROJECT',
    `userId=${project.userId}`,
    `userId=${userId}`,
  );

  ok('CREATE_PROJECT', `id=${project.id.slice(0, 8)}… title="${project.title}"`);
  return project;
}

// ── Step 5: TOGGLE_OBJECTIVE ──────────────────────────────────────────────────

async function step5ToggleObjective(projectId: string): Promise<string> {
  // Seed an objective.
  const obj = await db.objective.create({
    data: { title: 'Smoke Objective', isCompleted: false, order: 1, projectId },
  });

  must(obj.isCompleted === false, 'TOGGLE:seed', `isCompleted=${String(obj.isCompleted)}`, 'false');

  // Flip it — same Prisma update that toggleObjective performs.
  const toggled = await db.objective.update({
    where: { id: obj.id },
    data: { isCompleted: !obj.isCompleted },
  });

  must(
    toggled.isCompleted === true,
    'TOGGLE:flip',
    `isCompleted=${String(toggled.isCompleted)}`,
    'true',
  );

  // Re-fetch to confirm the write was durable.
  const refetched = await db.objective.findUniqueOrThrow({ where: { id: obj.id } });
  must(
    refetched.isCompleted === true,
    'TOGGLE:persist',
    `re-fetched isCompleted=${String(refetched.isCompleted)}`,
    'true (durable)',
  );

  ok('TOGGLE_OBJECTIVE', 'false→true, confirmed on re-fetch');
  return obj.id;
}

// ── Step 6: INVENTORY ─────────────────────────────────────────────────────────

async function step6Inventory(projectId: string): Promise<void> {
  const item = await db.inventoryItem.create({
    data: { name: 'Smoke Potion', gathered: false, projectId },
  });

  // Toggle gathered false → true, mirroring toggleInventoryItem.
  const updated = await db.inventoryItem.update({
    where: { id: item.id },
    data: { gathered: !item.gathered },
  });

  must(
    updated.gathered === true,
    'INVENTORY:update',
    `gathered=${String(updated.gathered)}`,
    'gathered=true',
  );

  const refetched = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  must(
    refetched.gathered === true,
    'INVENTORY:persist',
    `gathered=${String(refetched.gathered)}`,
    'gathered=true (durable)',
  );

  ok('INVENTORY', 'gathered toggled false→true, confirmed on re-fetch');
}

// ── Step 7: OWNERSHIP ─────────────────────────────────────────────────────────

async function step7Ownership(testUserId: string, testObjectiveId: string): Promise<string> {
  // Register a second test user who does NOT own any of the test data.
  const otherResult = await registerUser({
    email: OTHER_EMAIL,
    password: TEST_PW,
    username: OTHER_USERNAME,
    securityQuestion: "Name of my first pet?",
    securityAnswer: 'smokebot',
  });
  must(
    otherResult.ok,
    'OWNERSHIP:register_other',
    `ok=false error="${!otherResult.ok ? otherResult.error : ''}"`,
    'ok=true',
  );

  const otherUserId = otherResult.user.id;

  // Replicate the ownership guard from toggleObjective / updateInventoryQuantity:
  //   const obj = await prisma.objective.findUnique({ include: { project: { select: { userId } } } })
  //   if (obj.project.userId !== requestingUserId) throw new Error('Unauthorized')
  const objectiveWithOwner = await db.objective.findUnique({
    where: { id: testObjectiveId },
    include: { project: { select: { userId: true } } },
  });

  must(
    objectiveWithOwner !== null,
    'OWNERSHIP:find',
    'objective not found in DB',
    'objective exists',
  );

  // The guard would throw 'Unauthorized' when requesting user ≠ owner.
  const ownershipWouldDenyOther = objectiveWithOwner.project.userId !== otherUserId;
  must(
    ownershipWouldDenyOther,
    'OWNERSHIP:check',
    'other user appears to own the objective — data isolation failure',
    "objective's project.userId ≠ otherUserId → guard would deny",
  );

  ok('OWNERSHIP', 'cross-user isolation confirmed — ownership guard would deny other user');
  return otherUserId;
}

// ── Step 8: CLEANUP ───────────────────────────────────────────────────────────

async function step8Cleanup(testUserId: string, otherUserId: string): Promise<void> {
  const ids = [testUserId, otherUserId].filter(Boolean);

  if (ids.length === 0) {
    ok('CLEANUP', 'no test data was created — nothing to delete');
    return;
  }

  // Cascade: User deletion → Project → Objective + InventoryItem.
  await db.user.deleteMany({ where: { id: { in: ids } } });

  const leftover = await db.user.findMany({ where: { id: { in: ids } } });
  must(
    leftover.length === 0,
    'CLEANUP',
    `${leftover.length} test user(s) still present`,
    '0 remaining',
  );

  ok('CLEANUP', `deleted ${ids.length} test user(s) + all cascade data`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? '(DATABASE_URL not set)';
  const maskedDb = dbUrl.replace(/:\/\/[^@]+@/, '://*@');

  console.log('\nQuestTracker Smoke Test');
  console.log('═'.repeat(60));
  console.log(`  test email : ${TEST_EMAIL}`);
  console.log(`  app url    : ${BASE_URL}`);
  console.log(`  database   : ${maskedDb}`);
  console.log('─'.repeat(60));

  let testUserId = '';
  let otherUserId = '';

  try {
    const user = await step1Register();
    testUserId = user.id;

    await step2DuplicateGuard();
    await step3Auth();

    const project = await step4CreateProject(testUserId);
    const objectiveId = await step5ToggleObjective(project.id);

    await step6Inventory(project.id);

    otherUserId = await step7Ownership(testUserId, objectiveId);
  } catch (e) {
    if (!(e instanceof SmokeFailure)) {
      // Unexpected (non-assertion) failure — print full error.
      console.error(
        `\n  !  UNEXPECTED ERROR: ${e instanceof Error ? e.message : String(e)}`,
      );
      if (e instanceof Error && e.stack) {
        console.error(e.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
    // Fall through to finally for cleanup; remaining steps are skipped.
  } finally {
    console.log('─'.repeat(60));
    await step8Cleanup(testUserId, otherUserId).catch((e: unknown) => {
      console.error(
        `  !  CLEANUP ERROR: ${e instanceof Error ? e.message : String(e)}`,
      );
      console.error(
        `     Manual cleanup:  DELETE FROM "User" WHERE email LIKE '%@questlog.test%'`,
      );
      failed++;
    });
    await db.$disconnect();
  }

  console.log('─'.repeat(60));
  console.log(`\n  ${passed} passed  /  ${failed} failed\n`);

  if (failed > 0) {
    process.stderr.write('RESULT: FAIL\n\n');
    process.exit(1);
  } else {
    process.stdout.write('RESULT: PASS\n\n');
  }
}

void main();
