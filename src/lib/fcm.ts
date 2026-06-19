// Server-only Firebase Cloud Messaging helper. Lazily initializes firebase-admin
// from a service-account JSON env var (FCM_SERVICE_ACCOUNT_JSON) and delivers a
// payload to a user's native device tokens, pruning ones FCM reports as dead.
// Imported only by server code (sendPushToUser) — never the client.

import { prisma } from '@/lib/prisma';

type Messaging = import('firebase-admin/messaging').Messaging;

// undefined = not yet attempted, null = unconfigured/failed.
let messaging: Messaging | null | undefined;

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
  if (!m) return;

  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return;

  await Promise.all(
    tokens.map(async (t) => {
      try {
        await m.send({
          token: t.token,
          notification: { title: payload.title, body: payload.body },
          data: { href: payload.href ?? '/', ...(payload.tag ? { tag: payload.tag } : {}) },
          android: { priority: 'high', ...(payload.tag ? { collapseKey: payload.tag } : {}) },
        });
      } catch (e) {
        const code = (e as { code?: string })?.code ?? '';
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
