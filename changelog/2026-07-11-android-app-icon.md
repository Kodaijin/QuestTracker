# 2026-07-11: Android app icon


- Replaced the default Capacitor launcher icon with the QuestTracker crest. Source art lives in `assets/` (`icon-only.png` full-bleed, `icon-foreground.png` for the adaptive foreground); all densities + adaptive layers were generated with `npx @capacitor/assets generate --android --iconBackgroundColor '#000000'`, which writes into `android/app/src/main/res/mipmap-*`. Re-run that command after changing the source art. Requires an APK rebuild to take effect.
