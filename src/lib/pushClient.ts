// Browser-only helper to subscribe the current device to Web Push and persist
// the subscription server-side. Imported only by client components.

import { getVapidPublicKey, savePushSubscription } from '@/app/actions/notifications';

/** Convert a base64url VAPID key into the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type SubscribeResult = { ok: true } | { ok: false; error: string };

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return { ok: false, error: 'Push notifications are not supported in this browser.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was denied.' };
  }

  const key = await getVapidPublicKey();
  if (!key) {
    return { ok: false, error: 'Push is not configured on the server (missing VAPID keys).' };
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });

  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: 'Could not read the push subscription.' };
  }

  return savePushSubscription({ endpoint, p256dh, auth });
}
