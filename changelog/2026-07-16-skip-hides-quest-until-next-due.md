# 2026-07-16: Skipped/scheduled repeating quests hide until due

- Repeating quests now appear on the active board (dashboard and Today) **only when they're due or missed**. A quest whose current occurrence is a future logical day is hidden until it comes due, via the new `isAwaitingNextOccurrence` helper in `src/lib/recurrence.ts` (dueDate past the end of today; NONE and SPECIFIC_DATE are never hidden this way).
- This makes **Skip today** hide the quest until its next reset (a skipped daily disappears until tomorrow), and it also means a **weekly** quest shows only on its scheduled day and a **Mon/Wed/Fri** quest only on those days, instead of sitting on the board every day.
- On the dashboard the rule is bypassed while a search/filter is active, so a hidden quest is still reachable when you go looking for it. The Today list always applies it. Reset-hour aware (per-quest override falls back to the user's global `resetHour`, passed into the client components).
