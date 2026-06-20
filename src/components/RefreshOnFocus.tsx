'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNative, setupAppResume } from '@/lib/native';

/**
 * Keep the current page's server data fresh when the user returns to the app.
 * `router.refresh()` re-runs the route's server components (re-querying quests),
 * which is what surfaces changes made elsewhere — another browser, or the Android
 * app — without a manual reload. Fires when:
 *   • the browser tab / PWA becomes visible again or regains focus, and
 *   • the Capacitor app resumes from the background (Android).
 *
 * Mounted once from Providers. A no-op cost when nothing changed.
 */
export default function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);

    let resumeCleanup: (() => void) | undefined;
    if (isNative()) {
      void setupAppResume(refresh).then((c) => {
        resumeCleanup = c;
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      resumeCleanup?.();
    };
  }, [router]);

  return null;
}
