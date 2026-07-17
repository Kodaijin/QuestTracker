# 2026-06-19: Fresh quest data without a manual refresh


- Quests created or completed (including changes from another browser or the Android app) now appear without a hard reload. The client Router Cache was serving a stale snapshot on back-navigation, which overwrote the freshly-updated quest store; `experimental.staleTimes.dynamic = 0` makes dynamic pages always refetch on navigation
- New `RefreshOnFocus` component (mounted in `providers.tsx`) calls `router.refresh()` when the tab/PWA becomes visible or focused, and when the Capacitor app resumes from the background (new `setupAppResume` helper) — so the Android app no longer needs a full close-and-reopen to pick up changes
