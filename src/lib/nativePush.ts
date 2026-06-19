// Native FCM push registration for the Capacitor app. Imported only by the
// client NativeBridge, and only invoked when running natively. Requests
// permission, persists the FCM token via a Server Action, and routes taps.

import { saveDeviceToken } from '@/app/actions/notifications';

/**
 * Register this device for FCM push and persist its token. `onTap` is called
 * with the target href when the user taps a delivered notification. Returns a
 * cleanup function that removes the listeners. Safe to call only when native.
 */
export async function registerNativePush(
  onTap: (href: string) => void,
): Promise<() => void> {
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return () => {};

  const registration = await PushNotifications.addListener('registration', (token) => {
    void saveDeviceToken({ token: token.value, platform: 'android' });
  });

  const tap = await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      const href = action.notification?.data?.href;
      onTap(typeof href === 'string' && href ? href : '/');
    },
  );

  await PushNotifications.register();

  return () => {
    void registration.remove();
    void tap.remove();
  };
}
