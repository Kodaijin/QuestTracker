import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the existing web app in a native shell.
 *
 * `server.url` loads the QuestTracker instance directly AS the app origin, which
 * is what makes Capacitor inject its native plugin bridge (PluginHeaders) into the
 * page — required for native plugins like Push Notifications to work. Loading the
 * server by JS-navigating from the bundled launcher instead leaves it an "external"
 * origin that Capacitor does NOT expose plugins to (PluginHeaders is undefined), so
 * push never registers.
 *
 * Trade-off: this hardwires the app to one server, so the `native/launcher`
 * server-picker is bypassed. To restore the multi-server picker, remove `url`
 * below (the app falls back to loading `webDir`) — but note native push won't work
 * on the picker-navigated origin.
 */
const config: CapacitorConfig = {
  appId: 'com.questtracker.app',
  appName: 'QuestTracker',
  webDir: 'native/launcher',
  server: {
    androidScheme: 'https',
    url: 'https://questtracker.k0d4.cloud',
    cleartext: false,
    allowNavigation: ['*'],
  },
};

export default config;
