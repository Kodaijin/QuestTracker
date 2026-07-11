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
  if (perm.receive !== 'granted') {
    // Denied → no token will ever be issued. Log so this is diagnosable via
    // remote WebView console (chrome://inspect) / logcat.
    console.warn('[push] notification permission not granted:', perm.receive);
    return () => {};
  }

  const registration = await PushNotifications.addListener('registration', (token) => {
    console.log('[push] FCM token received:', `…${token.value.slice(-8)}`);
    void saveDeviceToken({ token: token.value, platform: 'android' })
      .then((res) => {
        if (res.ok) console.log('[push] device token saved to server');
        else console.warn('[push] saveDeviceToken rejected:', res.error);
      })
      .catch((e) => console.error('[push] saveDeviceToken threw:', e));
  });

  // Surfaces the usual native-side failures: no Google Play services, a
  // google-services.json that doesn't match this build, or FCM being unreachable.
  const regError = await PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] FCM registration error:', JSON.stringify(err));
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
    void regError.remove();
    void tap.remove();
  };
}
