# 2026-06-22: Daily / Weekly / Other cadence containers


- The dashboard's **active board** is now split into bordered **Daily / Weekly / Other** containers so daily and weekly commitments are easy to scan at a glance. Daily = `DAILY` (and every-1-day); Weekly = `WEEKLY` / specific weekdays / every-N-weeks; everything else (one-off, monthly, specific date, every-N-days) falls under Other. Empty containers are hidden, and Upcoming/Completed sections are unchanged
- Drag-and-drop and the ↑/↓ buttons now **reorder within a container** (no cross-container moves); the persisted board order is rebuilt from the groups so existing `reorderProjects` persistence is unchanged
- The **Today** page (`/today`) groups by the same cadence containers instead of urgency buckets; each row still shows its countdown, overdue coloring, and recurrence label, and rows are sorted most-urgent-first within each container
- New shared `questCategory` helper + `QuestCategory` type in `src/lib/recurrence.ts`, used by `DashboardClient.tsx` and `TodayClient.tsx`
