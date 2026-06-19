// Server-only Web Push helper. Configures web-push from VAPID env lazily, sends
// a payload to all of a user's subscriptions, and prunes endpoints the push
// service reports as gone (404/410). Imported only by server actions / the
// reminder sweep — never the client.

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { sendFcmToUser } from '@/lib/fcm';

let configured = false;

/** Returns true if VAPID keys are present and web-push is ready to send. */
export function pushConfigured(): boolean {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:admin@questlog.local',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  href?: string;
  tag?: string;
}

/**
 * Deliver a payload to a user across every channel: browser Web Push and native
 * FCM (the Capacitor app). Each channel guards its own configuration, so one
 * working without the other is fine. This is the single fan-out point used by
 * the reminder sweep and any other server-side notification.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  await Promise.all([
    sendWebPushToUser(userId, payload),
    sendFcmToUser(userId, payload),
  ]);
}

/** Deliver a payload to every Web Push subscription a user has registered. */
async function sendWebPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushConfigured()) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        // 404 Not Found / 410 Gone → subscription is dead; drop it.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}
