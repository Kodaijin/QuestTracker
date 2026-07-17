# 2026-06-18: Android app (Capacitor)


- An optional Android wrapper built with Capacitor that connects to any QuestTracker server you enter and reuses the whole web UI. The native project is in `android/`, the first-run server picker in `native/launcher/`
- Native push via FCM as a second channel alongside Web Push: new `DeviceToken` model, `saveDeviceToken` / `deleteDeviceToken` actions, and an FCM branch in `sendPushToUser`. New optional `FCM_SERVICE_ACCOUNT_JSON` env var
- Settings gains a "Switch server" action and hides the browser-push control when running inside the app
- The fixed settings gear is offset by the device safe-area insets (with `viewport-fit=cover`) so it clears the Android status bar / notch instead of hiding behind it
