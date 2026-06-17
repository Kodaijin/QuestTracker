// Node-only scheduler bootstrap. Imported by instrumentation.ts only under the
// NEXT_RUNTIME === 'nodejs' guard, so its node-only dependency chain
// (reminders → push → web-push) never reaches the edge bundle.
//
// Starts a singleton interval that runs the reminder sweep. Single-container
// deploy only; for multi-instance, drive the sweep from an external cron instead.

import { runReminderSweep } from './lib/reminders';

const minutes = Number(process.env.REMINDER_SWEEP_MINUTES ?? '15');

if (Number.isFinite(minutes) && minutes > 0) {
  const g = globalThis as typeof globalThis & { __questlogReminderTimer?: NodeJS.Timeout };
  if (!g.__questlogReminderTimer) {
    const tick = () => {
      runReminderSweep().catch((e) => console.error('[reminders] sweep failed:', e));
    };
    g.__questlogReminderTimer = setInterval(tick, minutes * 60_000);
    // Kick off a first sweep shortly after boot (let the DB settle).
    setTimeout(tick, 30_000);
  }
}
