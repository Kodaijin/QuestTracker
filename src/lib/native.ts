// Helpers for when the web app runs inside the Capacitor native shell. All of
// these are no-ops / false in a normal browser, so callers can use them
// unconditionally from client components.

import { Capacitor } from '@capacitor/core';

/** The local origin the bundled launcher is served from (Android https scheme). */
const LAUNCHER_ORIGIN = 'https://localhost';

/** True when running inside the Capacitor native shell (vs a normal browser). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Return to the launcher's server picker so the user can point the app at a
 * different server. The launcher clears the saved URL when it sees `?switch=1`.
 */
export function switchServer(): void {
  window.location.href = `${LAUNCHER_ORIGIN}/?switch=1`;
}

/**
 * Route the Android hardware back button through the WebView history, exiting
 * the app only when there's nowhere left to go back to. Returns a cleanup fn.
 */
export async function setupBackButton(): Promise<() => void> {
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });
  return () => {
    void handle.remove();
  };
}

/**
 * Run `cb` whenever the native app returns to the foreground. The Android WebView
 * stays alive in the background, so without this it shows a stale snapshot until a
 * full restart; refreshing on resume keeps quest data current. Returns a cleanup fn.
 */
export async function setupAppResume(cb: () => void): Promise<() => void> {
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('resume', cb);
  return () => {
    void handle.remove();
  };
}
