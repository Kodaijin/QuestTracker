// Server-only Firebase Cloud Messaging helper. Lazily initializes firebase-admin
// from a service-account JSON env var (FCM_SERVICE_ACCOUNT_JSON) and delivers a
// payload to a user's native device tokens, pruning ones FCM reports as dead.
// Imported only by server code (sendPushToUser) — never the client.

import { prisma } from '@/lib/prisma';

type Messaging = import('firebase-admin/messaging').Messaging;

// undefined = not yet attempted, null = unconfigured/failed.
let messaging: Messaging | null | undefined;
// Guards a single "tokens exist but FCM is unconfigured" warning per process, so
// the common silent-misconfiguration case is visible in the logs without spam.
let warnedUnconfigured = false;

/** Returns true if an FCM service account is configured. */
export function fcmConfigured(): boolean {
  return Boolean(process.env.FCM_SERVICE_ACCOUNT_JSON);
}

async function getMessaging(): Promise<Messaging | null> {
  if (messaging !== undefined) return messaging;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    messaging = null;
    return null;
  }
  try {
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    const { getMessaging: getMessagingFn } = await import('firebase-admin/messaging');
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(JSON.parse(raw)) });
    messaging = getMessagingFn(app);
  } catch (e) {
    console.error('[fcm] initialization failed', e);
    messaging = null;
  }
  return messaging;
}

export interface FcmPayload {
  title: string;
  body: string;
  href?: string;
  tag?: string;
}

/** Deliver a payload to every FCM device token a user has registered. */
export async function sendFcmToUser(userId: string, payload: FcmPayload): Promise<void> {
  const m = await getMessaging();
  if (!m) {
    // Surface the most common cause of "Android push isn't working": device
    // tokens are registered but FCM_SERVICE_ACCOUNT_JSON is unset or invalid, so
    // every send silently no-ops. Warn once, only if there's actually something
    // that would otherwise be delivered.
    if (!warnedUnconfigured) {
      const count = await prisma.deviceToken.count().catch(() => 0);
      if (count > 0) {
        warnedUnconfigured = true;
        console.warn(
          `[fcm] ${count} device token(s) registered but FCM_SERVICE_ACCOUNT_JSON is unset or invalid — ` +
            'Android push is disabled. See the "Android app" section of the README.',
        );
      }
    }
    return;
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) {
    console.log(`[fcm] no device tokens for user ${userId} — nothing to send`);
    return;
  }

  await Promise.all(
    tokens.map(async (t) => {
      try {
        const id = await m.send({
          token: t.token,
          notification: { title: payload.title, body: payload.body },
          data: { href: payload.href ?? '/', ...(payload.tag ? { tag: payload.tag } : {}) },
          android: { priority: 'high', ...(payload.tag ? { collapseKey: payload.tag } : {}) },
        });
        // Temporary diagnostic: confirms FCM accepted the message for delivery.
        console.log(`[fcm] sent to …${t.token.slice(-8)} → ${id}`);
      } catch (e) {
        const code = (e as { code?: string })?.code ?? '';
        const message = (e as { message?: string })?.message ?? String(e);
        // Temporary diagnostic: the exact reason a send was rejected. Common ones:
        //   messaging/mismatched-credential → service account is from a different
        //   Firebase project than the token's google-services.json.
        console.warn(`[fcm] send failed for …${t.token.slice(-8)}: ${code} — ${message}`);
        // Token no longer valid → drop it.
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument')
        ) {
          await prisma.deviceToken.delete({ where: { id: t.id } }).catch(() => {});
        }
      }
    }),
  );
}
