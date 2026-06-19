import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the existing web app in a native shell. The bundled `webDir`
 * is just a small launcher (native/launcher) that asks for the server URL and
 * then navigates the WebView to that live QuestTracker instance. `allowNavigation`
 * lets the WebView load any user-entered host. The launcher itself is served at
 * the local origin `https://localhost`.
 */
const config: CapacitorConfig = {
  appId: 'com.questtracker.app',
  appName: 'QuestTracker',
  webDir: 'native/launcher',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
  },
};

export default config;
