# 2026-07-11: Android push — load the server as the app origin


- **Root cause of Android push never registering:** the app loaded the server by JS-navigating the WebView from the bundled launcher to the remote URL, which Capacitor treats as an *external* origin and does **not** expose native plugins to (`Capacitor.PluginHeaders` was `undefined` on the page, so `PushNotifications` reported "not implemented on android" and no FCM token was ever requested).
- **Fix:** `capacitor.config.ts` now sets `server.url` to the QuestTracker instance so Capacitor loads it *as* the app origin and injects the plugin bridge. Trade-off: this hardwires the app to one server (the `native/launcher` picker is bypassed); remove `server.url` to restore the picker, at the cost of native push. Requires an APK rebuild + reinstall.
- Added a temporary `[push] bridge check …` diagnostic in `registerNativePush` that logs the exposed plugin list — how the above was pinpointed.
