'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNative, setupBackButton } from '@/lib/native';
import { registerNativePush } from '@/lib/nativePush';

/**
 * Wires native-shell behaviors when running inside Capacitor: the Android
 * hardware back button, and native FCM push registration. A no-op in a normal
 * browser. Mounted once from Providers.
 */
export default function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;

    let backCleanup: (() => void) | undefined;
    let pushCleanup: (() => void) | undefined;

    void setupBackButton().then((c) => {
      backCleanup = c;
    });
    void registerNativePush((href) => router.push(href)).then((c) => {
      pushCleanup = c;
    });

    return () => {
      backCleanup?.();
      pushCleanup?.();
    };
  }, [router]);

  return null;
}
