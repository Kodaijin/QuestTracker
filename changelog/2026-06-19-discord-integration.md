# 2026-06-19: Discord integration


- An optional Discord channel webhook as a third notification surface alongside Web Push and FCM. Posts daily reminders, new group-quest invites, deadline alerts, and group-quest completions to a shared channel, @mentioning each opted-in user
- New optional `DISCORD_WEBHOOK_URL` env var; the integration is fully disabled when it's unset. New `User.discordUsername` field (a username for display, or a numeric Discord User ID for a real ping), captured at signup and editable in Settings via a `changeDiscordUsername` action
- New sender `src/lib/discord.ts`; the daily-reminder and deadline events flow through the reminder sweep, group-quest creation/invites through `createProject` / `inviteToQuest`, and completions through `toggleObjective`. All Discord delivery is best-effort and never blocks a quest action or sweep
