# QuestTracker

A gamified, RPG-flavored task tracker. Turn your projects into quests, break them into objectives, check off the loot you've gathered, earn XP to level up your hero, keep a daily streak, unlock achievements, and let recurring quests reset themselves on a schedule.

Built with Next.js (App Router), Prisma, PostgreSQL, and NextAuth, and fully containerized with Docker.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
  - [Run with Docker (recommended)](#run-with-docker-recommended)
  - [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Android app](#android-app)
- [Discord integration](#discord-integration)
- [Data model](#data-model)
- [Changelog](#changelog)
- [License](#license)

## Features

- **Quests**: projects with a title, description, and custom icon, created with their objectives (and optional inventory) up front
- **Epic Quests**: quests whose "objectives" are full sub-quests (each with its own objectives, inventory, and page), optionally enforced in order so later sub-quests stay locked (🔒) until earlier ones are complete
- **Objectives**: ordered, checkable sub-tasks that drive each quest's completion progress. Every quest needs at least one. Reorder them by dragging the grip handle (⠿) or with the ↑/↓ controls, and optionally enforce **in-order completion** so later objectives stay locked (🔒) until earlier ones are done
- **Inventory**: a checklist of named items a quest needs. Check each off as you gather it, and reorder items by dragging (⠿) or with ↑/↓
- **Reorder anything**: quests on the dashboard, objectives, and inventory items all reorder by dragging a grip handle (⠿) or with the ↑/↓ controls — whichever you prefer. The drag handles are touch-friendly for the Android app, and keyboard reordering works too (focus the handle, Space to lift, arrow keys to move). On touch devices the controls stay visible since there's no hover
- **Export & import**: back up all your quests to a JSON file from Settings, and import a file to add them to your board (objectives, inventory, epics, recurrence, and completion state all round-trip)
- **XP & leveling**: every objective, gathered item, and completed quest awards XP, and un-checking claws it back. XP drives your level along a quadratic curve and an evolving rank title (Novice → Squire → Knight → Champion → Hero → Legend), with a level-up celebration
- **Difficulty & rarity**: tag a quest Trivial → Legendary. Harder quests award more XP and glow brighter on the board
- **Daily streaks**: keep a flame going by completing something each day. Tracks your current and longest streak with at-risk warnings
- **Hero profile** (`/hero`): your home base for level, XP bar, rank title, streaks, lifetime stats, and recent badges
- **Today / Agenda** (`/today`): active quests grouped into Daily, Weekly, and Other containers (sorted most-urgent-first, with per-row countdowns and overdue coloring)
- **Calendar** (`/calendar`): a month grid plotting recurring and scheduled quests
- **Insights** (`/insights`): a contribution heatmap, XP over time, completions by type, quests by difficulty, and achievement progress
- **Tags, search & filters**: tag quests for grouping, then search and filter the board by text, difficulty, or tag
- **Achievements**: 50+ cheeky badges (including streak milestones) unlocked just by using the app, tracked per user and never revoked once earned
- **Completion effects**: a quick sparkle and glow when you check an objective, and a "Quest Complete!" celebration when a quest is finished. On level-ups, quest completions, and companion evolutions the celebration plays as a WebGL particle burst with bloom where WebGL is available, and falls back to the CSS effect otherwise. All of it respects `prefers-reduced-motion`
- **Recurring quests**: daily, every N days, weekly, on a set of weekdays (e.g. Mon/Wed/Fri), every N weeks, monthly, or a specific date. Elapsed quests advance automatically on load. A configurable **daily reset time** (global default in Settings, overridable per quest) controls when each day rolls over — e.g. 4 AM so late-night activity counts for the prior day
- **Party & group quests** (`/party`): add allies by unique username (they accept or decline), then share a quest with chosen allies when you create it. Invited heroes accept per invite. Once joined, the party shares the same progress and every member earns XP when it's completed. Members can always check off shared progress, and the owner can let members edit the quest too (objectives, inventory, and settings) with a per-quest toggle. Only the owner can delete it, but any member can leave a shared quest from its page at any time (their past XP stays). Either ally can also remove the other at any time, which severs their shared-quest memberships in both directions. A notice badge in the nav surfaces pending ally requests and quest invites
- **Give a quest to an ally**: build a quest, then hand it to a single ally to *do* it — either right from the **New Quest** form (a **Share / Give** toggle in the Party section) or later from the quest's **🎁 Give this quest** card. Unlike a co-op shared quest, the recipient checks the objectives off but can't edit it, while you keep editing and watch their progress — and the reward is split, with the recipient earning full XP and you (the giver) half. The recipient gets an alert + push and accepts or declines it on their Party page
- **Companion pet**: adopt a companion from a wide roster (cat, dragon, fox spirit, dog, owl, penguin, unicorn, and more) on your hero page. It evolves as you level up (Egg → Hatchling → Juvenile → Adult → Mythic) and reacts to your streak with a mood, and each evolution gets its own celebration
- **Reminders** (`/notifications`): opt-in web push notifications (delivered even when the app is closed) plus an in-app alert center for come-back nudges, streak-at-risk warnings, approaching quest deadlines, and a "your companion misses you" poke. Per-type toggles and a daily reminder time live in Settings
- **Quest Gems & Shop** (`/shop`): earn 💎 gems by leveling up, unlocking achievements, and hitting streak milestones, then spend them on cosmetics: animated XP-bar styles, frames and glows for your hero panel, WebGL celebration effects, and WebGL backgrounds. The gem balance is derived from your (farm-proof) progress, so it can't be cheesed by toggling quests. A spinning 3D gem-balance chip lives in the nav
- **Backgrounds**: pick your ambient backdrop in Settings or the Shop. The classic CSS aurora is the free default. A dozen WebGL backgrounds (living aurora, nebula, galaxy, ocean, synthwave, rainstorm, and more) render as shaders, some free and some gem-priced. They fall back to the CSS aurora on devices without WebGL or with `prefers-reduced-motion`
- **Free cosmetics mode**: if you'd rather skip the gem economy, a Settings toggle unlocks every cosmetic for free, so you can equip any XP bar, frame, celebration effect, or background without earning or spending Quest Gems
- **Authentication**: email/password accounts via NextAuth, each with a unique username for party invites and a security-question password reset flow
- **Custom icons**: upload and auto-resize quest icons
- **Android app**: an optional Capacitor wrapper that connects to any QuestTracker server you enter and reuses the whole web UI. Background notifications use native FCM push, while the website keeps using Web Push. See [Android app](#android-app)
- **Discord notifications**: an optional shared-channel webhook that posts rich-embed messages for daily reminders, new group-quest invites, party progress updates, deadline alerts, and group-quest completions, @mentioning each user. Opt in per user by adding a Discord handle (numeric User ID for a real ping) in Settings. An optional bot adds `/addquest` and `/quests` slash commands. See [Discord integration](#discord-integration)

## Tech stack

| Layer    | Tool                                   |
| -------- | -------------------------------------- |
| Framework| Next.js 14 (App Router, Server Actions)|
| Language | TypeScript                             |
| Database | PostgreSQL                             |
| ORM      | Prisma                                 |
| Auth     | NextAuth                               |
| Styling  | Tailwind CSS                           |
| 3D / WebGL| three.js via react-three-fiber + drei + postprocessing (lazy-loaded) |
| State    | Zustand                                |
| Runtime  | Docker / Docker Compose                |

## Getting started

### Run with Docker (recommended)

The compose file brings up Postgres and the app together.

```bash
# 1. Configure environment
cp .env.example .env
# edit .env and set a strong NEXTAUTH_SECRET (and the TZ for your locale)

# 2. Build and start
docker compose up --build
```

The app is available at http://localhost:3000.

### Run locally

Requires Node.js and a running PostgreSQL instance.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# point DATABASE_URL at your Postgres instance and set NEXTAUTH_SECRET

# 3. Apply the schema
npm run db:migrate

# 4. Start the dev server
npm run dev
```

## Environment variables

| Variable          | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`    | PostgreSQL connection string                                       |
| `POSTGRES_USER`   | Postgres user (used by the Docker DB service)                      |
| `POSTGRES_PASSWORD`| Postgres password (used by the Docker DB service)                 |
| `POSTGRES_DB`     | Postgres database name (used by the Docker DB service)             |
| `NEXTAUTH_SECRET` | Secret used to sign NextAuth sessions (change this)                |
| `NEXTAUTH_URL`    | Public base URL of the app (e.g. `https://quests.example.com`). Behind a proxy, set this to your real domain, not `localhost` |
| `ALLOWED_ORIGINS` | Comma-separated public origin host(s) allowed to invoke Server Actions. Required behind a reverse proxy or Cloudflare Tunnel (host only, no protocol). `NEXTAUTH_URL`'s host is trusted automatically |
| `TZ`              | Timezone for quest reset and day-boundary logic (e.g. `Etc/GMT+8`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push keypair for reminders. Generate with `npx web-push generate-vapid-keys --json` |
| `VAPID_SUBJECT`   | Contact for the push service, a `mailto:` or URL                   |
| `REMINDER_SWEEP_MINUTES` | How often the reminder scheduler runs, in minutes (`0` disables it; default `15`) |
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase service-account JSON (single line) for native push in the Android app. Optional; leave empty to disable native push |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL for the [Discord integration](#discord-integration). Optional; leave empty to disable it entirely |
| `BOT_API_SECRET` | Shared secret authenticating the Discord bot to `/api/bot/quests`. Set on both the `app` and `bot` services. Optional; required only to run the bot |
| `DISCORD_BOT_TOKEN` | Bot token for the optional Discord bot service. Optional; leave empty to skip the bot |
| `DISCORD_APP_ID` | Discord application ID, used to register the bot's slash commands. Required for the bot |
| `DISCORD_GUILD_ID` | Discord server ID for instant per-guild slash-command registration. Optional; without it commands register globally (slower to appear) |

See `.env.example` for a complete template. Note that web push requires HTTPS in production (localhost is exempt for development).

> Running behind a reverse proxy or Cloudflare Tunnel? Next.js checks that a Server Action's `Origin` matches the forwarded `Host`. A proxy that rewrites the `Host` (for example to `localhost:3000`) breaks that check, and every mutation returns 500. Set `ALLOWED_ORIGINS` (and `NEXTAUTH_URL`) to your public domain. The standalone server bakes this into the build, so it's passed as a Docker build arg: rebuild with `docker compose up -d --build` after changing it.

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start the development server         |
| `npm run build`      | Production build                     |
| `npm run start`      | Start the production server          |
| `npm run typecheck`  | Type-check with `tsc --noEmit`       |
| `npm run db:migrate` | Run Prisma migrations (dev)          |
| `npm run db:generate`| Generate the Prisma client           |
| `npm run smoke`      | Run the database/auth smoke test     |
| `npm run icons:resize`| Resize quest icons                  |

## Android app

QuestTracker ships an optional Android wrapper built with Capacitor. On first
launch it asks for your server's address, then loads that live instance in a
WebView, so it reuses the entire web UI and your existing account. The website
stays the primary product and is unchanged. The native project lives in
`android/`, and the first-run server picker is the static page in
`native/launcher/`.

Build and run it (requires Android Studio with the Android SDK):

```bash
# Copy the launcher into the native project and sync plugins
npx cap sync android

# Open in Android Studio, then run on a device or emulator
npx cap open android
```

Notifications: the browser and PWA use Web Push, but a WebView needs native push,
so the app uses Firebase Cloud Messaging. To enable it, create a Firebase project,
add its `google-services.json` to `android/app/`, and set
`FCM_SERVICE_ACCOUNT_JSON` on the server. Without it the app still works; you just
won't get background notifications on the device. FCM is delivered as a second
channel inside `sendPushToUser`, so reminders reach web and app subscribers alike.

## Discord integration

QuestTracker can post to a Discord channel through an incoming webhook. It's
optional and fully off until you set `DISCORD_WEBHOOK_URL`. A webhook targets a
single channel (it can't DM), so every message lands in that one channel and
@mentions the relevant user(s).

Set it up:

1. In Discord, open **Server Settings → Integrations → Webhooks → New Webhook**,
   pick the channel, and **Copy Webhook URL**.
2. Set `DISCORD_WEBHOOK_URL` on the server to that URL (see `.env.example`). Also
   make sure `NEXTAUTH_URL` is your real public URL — it's used to build the quest
   links in each message.
3. Each user opts in from **Settings → Discord** (or at signup) by entering a
   Discord handle. Paste a **numeric User ID** (Discord → Settings → Advanced →
   Developer Mode, then right-click a name → **Copy User ID**) for a real `<@id>`
   ping; a plain username also works but shows as grey text without notifying.
   Clearing the field opts the user back out.

All posts are formatted as **rich embeds** (colored, titled cards with fields and
a link back to the quest). Because Discord only resolves @mentions in a message's
top-level content — never inside an embed — any post that should ping carries the
mentions in the message content alongside the embed.

What gets posted (only for users who added a handle):

- **Daily reminder** — a once-a-day summary of still-open quests at the user's
  reminder hour (the existing Settings reminder time), deduped so it never reposts.
- **New group quest** — when a quest is shared with allies on creation, or allies
  are invited to an existing quest.
- **Party progress** — when any member of a shared quest checks an objective off or
  gathers an item: who did it, plus a done/remaining breakdown, pinging the party.
- **Deadline alerts** — when a quest is due within 24 hours or just became active.
- **Group-quest completion** — a celebration when a shared quest is fully finished
  (solo completions are skipped to avoid noise).

Delivery is best-effort: a missing or broken webhook never blocks quest creation
or the reminder sweep. The sender lives in `src/lib/discord.ts` (`sendDiscordEmbed`
plus the `EmbedColors` palette); sweep-driven events flow through the reminder
sweep (`src/lib/reminders.ts`) and quest events through the project/party server
actions.

### Discord bot (slash commands)

An optional containerized bot (in `bot/`) lets users create and view quests from
Discord with `/addquest` and `/quests`. It's separate from the webhook above and
fully off unless you configure it.

Set it up:

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications),
   add a **Bot**, and copy its **token**. Copy the **Application ID** from General
   Information, and (recommended) your **server ID** (enable Developer Mode, then
   right-click the server → **Copy Server ID**).
2. **Privileged Gateway Intents** (Bot tab): leave **all three OFF** — Presence,
   Server Members, and Message Content. The bot only handles slash-command
   interactions, so it needs none of them.
3. Invite the bot via **OAuth2 → URL Generator**:
   - **Scopes:** `bot` and `applications.commands`.
   - **Bot Permissions:** none are required. Replies are sent ephemerally as
     interaction responses (which ignore channel permissions), and the colored
     channel embeds come from the webhook above, not the bot. `Send Messages` is a
     harmless default if you'd rather not leave it empty.

   Open the generated URL and authorize the bot into your server.
4. Set `DISCORD_BOT_TOKEN`, `DISCORD_APP_ID`, `DISCORD_GUILD_ID`, and a shared
   `BOT_API_SECRET` (the same value on the `app` and `bot` services). See
   `.env.example`. `BOT_API_SECRET` is a secret you generate yourself — any long
   random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
5. Run the bot service: `docker compose up --build bot` (it starts with the rest of
   the stack too). On startup it registers its slash commands automatically.

Each user must have their **numeric Discord ID** saved under **Settings → Discord**
so the bot can map their Discord account to their QuestTracker account; otherwise
the command replies with a hint to link it. The bot never touches the database
directly — it calls the secured `/api/bot/quests` route, which reuses the same
quest-creation logic (`createProjectForUser`) as the web UI.

## Data model

- **User**: owns many projects, completion events, and unlocked achievements. Stores credentials, a unique `username` (used for party invites), an optional security question, and an optional `discordUsername` (a handle or numeric ID for the Discord integration)
- **Project (Quest)**: title, description, icon, `difficulty`, `tags`, recurrence settings, and due/completion dates. A `sortOrder` sets its place on the dashboard, and `sequentialObjectives` enforces in-order objective completion. An Epic is a Project with `isEpic`; its sub-quests are Projects pointing back via `parentId` (with `epicOrder` for sequencing and a `sequential` flag on the Epic)
- **Objective**: ordered (by `order`), completable sub-tasks belonging to a quest
- **InventoryItem**: named items belonging to a quest, each with a `gathered` checkbox state and an `order` for manual sequencing
- **CompletionEvent**: an append-only log of every objective/item/quest completion (with awarded XP and timestamp). The source of truth for XP, levels, streaks, and insights
- **UnlockedAchievement**: records which achievement a user earned and when (unique per user + achievement key)
- **Connection**: a hero-to-hero ally link between a requester and addressee, with a pending/accepted/declined status (one per pair)
- **QuestMember**: a per-quest invite linking a quest to an invited user (the owner stays `Project.userId`), with a pending/accepted/declined status. Accepted members share progress and earn XP. `Project.membersCanEdit` controls whether accepted members may edit the quest or only check off progress
- **Pet**: a user's companion (species + name). Its stage and mood are derived at read time from level and streak, so nothing else is stored
- **PushSubscription**: a browser Web Push endpoint registered by a user for notifications
- **DeviceToken**: a native FCM token registered by the Capacitor Android app, the app-side counterpart to `PushSubscription`
- **Notification**: in-app alert history and the source of truth for push de-duplication (unique per user + type + key)
- **NotificationPreference**: per-user reminder toggles, the daily reminder hour, and the daily reset hour (`resetHour`, default 4)
- **CosmeticUnlock**: a cosmetic the user bought with gems (ownership only). The gem balance is derived as `earned − sum(owned prices)`, never stored as a counter. Equipped selections live on `User` (`themeId`/`xpBarId`/`frameId`/`particleId`/`backgroundId`), and the catalog and economy are code-defined in `src/lib/cosmetics.ts`. Free cosmetics (such as the default backgrounds) can be equipped without a purchase, and the per-user `cosmeticsFree` flag unlocks everything for users who opt out of the gem economy

## Changelog

### 2026-07-11: Give a quest to an ally

- **Give a quest** you built to a single ally to *do*. Hand it off either from the **New Quest** form (the **Party** section has a **Share (co-op) / Give to an ally** toggle) or later from the quest's **🎁 Give this quest** card. The recipient gets a full in-app alert + push and an **Accept / Decline** card on their Party page (reusing the existing `QuestMember` invite flow via `respondToQuestInvite`). New `giveQuest` action in `src/app/actions/party.ts`
- Unlike a co-op shared quest, a **given quest** is one-to-one and locks editing to the giver: the recipient checks objectives off (they *can't* edit), while the giver keeps edit rights and watches progress. Marked by a new `Project.isGiven` flag (recipient membership is forced to `membersCanEdit=false`)
- **XP is split**: the recipient earns **full** XP for completions, the giver earns **half** (`Math.floor`). A new `acceptedParticipants` helper in `src/app/actions/projects.ts` carries a per-user XP factor through `toggleObjective` / `toggleInventoryItem`
- If the recipient declines (or gives it back via the quest's **Give it back** button), the quest frees up and can be given again
- **Pending quests surface on the dashboard**: a "Quests awaiting your response" panel now sits above the board's search/filter row, listing both co-op invites and given quests with **Accept / Decline** buttons (reusing `respondToQuestInvite`) — no need to visit the Party page. Fed by `listQuestInvites()` in `src/app/page.tsx`
- **Response notifications**: when someone accepts or declines a quest you invited them to (or gave them), you now get an in-app alert + push (+ Discord), e.g. *"@ally accepted the quest you gave them."* `respondToQuestInvite` emits a `party`-type notification back to the quest owner

### 2026-07-01: Configurable daily reset time + Days-of-week are Daily

- Repeating quests used to roll over at a hard-coded midnight boundary, so a quest finished late at night could reset right away. There's now a **daily reset time** (a "day" runs from the reset hour to the reset hour) that you set in **Settings → Daily reset time** (default **04:00**, so late-night activity still counts toward the previous day). Individual quests can override it with a **Reset time** picker in the New Quest form and the Schedule editor (`Project.resetHour`, null = follow the global default in `NotificationPreference.resetHour`)
- The reset hour shifts the day boundary used by all recurrence math. `src/lib/recurrence.ts` now anchors on the *logical day* (`logicalDate`/`boundaryForDate`/`endOfLogicalDay`) and every `computeFirstDueDate` / `computeNextDueDate` / `occurrencesInRange` call passes the effective reset hour (`syncRecurringQuests`, `dismissMissedQuest`, `normaliseRecurrence`, import). Existing quests self-heal on their next roll-over — no backfill needed
- **"Days of week" (multi-weekday) quests are now categorized as Daily**, not Weekly, since they can come due several days a week. They appear in the ☀ Daily container and their badge now reads e.g. `Mon, Wed, Fri` (`questCategory` + `recurrenceLabel` in `src/lib/recurrence.ts`)

### 2026-06-25: Skip a missed recurring quest

- Recurring quests that lapse a cycle now show a **Skip** button on their ⚠ Missed badge (dashboard cards, the Today list, and the quest page). Skipping drops the overdue cycle with **no completion and no XP**, resets objectives, and resumes the schedule at the **current** occurrence — so the quest stops showing as missed but keeps repeating. New `dismissMissedQuest` action in `src/app/actions/projects.ts`; only repeating quests are skippable (one-offs and specific-date quests have no next occurrence). Any participant of a shared quest may skip
- **Completing a missed quest no longer double-counts.** Previously, completing an overdue cycle rolled the due date forward to *today*, so the quest immediately reappeared and had to be done again. The roll-over in `syncRecurringQuests` now anchors on `lastCompletedAt`: a quest finished late counts once and advances to the **next** occurrence (it won't pop back up the same day), while a quest done on time but left idle for days still forgivingly resumes today

### 2026-06-22: Daily / Weekly / Other cadence containers

- The dashboard's **active board** is now split into bordered **Daily / Weekly / Other** containers so daily and weekly commitments are easy to scan at a glance. Daily = `DAILY` (and every-1-day); Weekly = `WEEKLY` / specific weekdays / every-N-weeks; everything else (one-off, monthly, specific date, every-N-days) falls under Other. Empty containers are hidden, and Upcoming/Completed sections are unchanged
- Drag-and-drop and the ↑/↓ buttons now **reorder within a container** (no cross-container moves); the persisted board order is rebuilt from the groups so existing `reorderProjects` persistence is unchanged
- The **Today** page (`/today`) groups by the same cadence containers instead of urgency buckets; each row still shows its countdown, overdue coloring, and recurrence label, and rows are sorted most-urgent-first within each container
- New shared `questCategory` helper + `QuestCategory` type in `src/lib/recurrence.ts`, used by `DashboardClient.tsx` and `TodayClient.tsx`

### 2026-06-22: Leave a shared quest

- Party members can now **leave a shared quest** from its page (the Party card shows a "Leave quest" button for non-owners). New `leaveQuest` action in `src/app/actions/party.ts` removes just that member's `QuestMember` row; the quest stays for the owner and others, and the leaver's already-earned XP is untouched. Owners still delete rather than leave

### 2026-06-22: More recurrence options — every N days & multiple weekdays

- Two new repeat schedules: **Every N days** (`EVERY_N_DAYS` + `Project.intervalDays`) and **Days of week** for picking multiple weekdays like Mon/Wed/Fri (`DAYS_OF_WEEK` + `Project.daysOfWeek` int array). Available in the New Quest form and a quest's Schedule editor
- Recurrence math, labels, calendar plotting, validation, and JSON export/import all handle the new kinds (`src/lib/recurrence.ts`, `src/app/actions/projects.ts`, `src/app/actions/data.ts`)

### 2026-06-22: Drag-and-drop everywhere + touch-visible controls

- Objectives and inventory items can now be **dragged by a grip handle (⠿)** to reorder, matching the dashboard quest cards (the ↑/↓ buttons stay too). New `reorderObjectives` / `reorderInventoryItems` server actions persist a full new order; built on `@dnd-kit` with a shared `SortableRow` wrapper and `verticalListSortingStrategy`
- **Touch visibility fix**: the reorder/edit/delete controls (and the new drag handles) were hidden behind `group-hover`, so they never appeared on touch devices like the Android app. They now stay visible on coarse-pointer (touch) devices via a `[@media(pointer:coarse)]` variant, while desktop keeps the hover-reveal

### 2026-06-21: Drag-and-drop board reordering

- Quests can now be rearranged on the dashboard by **dragging a card's grip handle (⠿)**, in addition to the ↑/↓ buttons. Built on `@dnd-kit` with a pointer sensor (touch-friendly for the Android WebView) and a keyboard sensor for accessible reordering. The handle is owner-only and hidden while a filter is narrowing the board; dragging reuses the existing `reorderProjects` action, so persistence is unchanged
- The per-quest **"Must be done in order"** objectives toggle moved out of the Objectives card to sit just above it on the quest page

### 2026-06-21: In-order objectives, reordering, and JSON export/import

- **In-order objectives**: a per-quest "Must be done in order" toggle (`Project.sequentialObjectives`) locks later objectives (🔒) until earlier ones are checked off — the objective-level analogue of an Epic's `sequential` sub-quests. Set it when creating a quest or from the quest's Objectives card. Enforced both in the UI and server-side in `toggleObjective` (mirrored by `lockedObjectiveIds` in `src/lib/quest.ts`)
- **Reordering**: objectives, inventory items, and quests can all be rearranged with ↑/↓ controls. Inventory gains an `order` column and quests a `sortOrder` (backfilled by age); new `reorderObjective`, `reorderInventoryItem`, and `reorderProjects` server actions. The dashboard's active board now follows your manual order instead of listing recurring quests first
- **Export & import**: a Settings card to download all your quests as JSON and import a file back. New `exportQuests` / `importQuests` actions in `src/app/actions/data.ts`. The snapshot carries no ids, XP, or party data, so importing never mints XP (XP stays derived from the CompletionEvent log); completion state round-trips and recurrence due-dates are recomputed on import

### 2026-06-20: Rich Discord embeds, a quest bot, and party progress notices

- All Discord posts are now **rich embeds** (color-coded titles, fields, and quest links) instead of plain text. New `sendDiscordEmbed` sender and an `EmbedColors` palette in `src/lib/discord.ts`; every call site (reminder sweep, group-quest creation/invites, completions) was converted. Mentions stay in the message content since Discord won't ping from inside an embed
- **Party progress notices**: when any member of a shared quest checks an objective off or gathers an item, the channel gets a "Quest Progress" embed showing who did it and a done/remaining breakdown, pinging the whole party. Wired into `toggleObjective` / `toggleInventoryItem` via a new `announceQuestProgress` helper, guarded to shared quests and skipped on the completing toggle (the completion embed covers that)
- **Discord bot** (new `bot/` service): `/addquest` and `/quests` slash commands built on discord.js, shipped as its own Docker image and Compose service. It calls a new secured `POST /api/bot/quests` route (bearer-auth via `BOT_API_SECRET`) that maps the caller's numeric Discord ID to a user through `User.discordUsername` and reuses `createProjectForUser` — the same logic extracted from `createProject` so the UI and bot share one code path
- New env vars: `BOT_API_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_APP_ID`, `DISCORD_GUILD_ID` (all optional; the bot stays off until set). See `.env.example`

### 2026-06-19: Fresh quest data without a manual refresh

- Quests created or completed (including changes from another browser or the Android app) now appear without a hard reload. The client Router Cache was serving a stale snapshot on back-navigation, which overwrote the freshly-updated quest store; `experimental.staleTimes.dynamic = 0` makes dynamic pages always refetch on navigation
- New `RefreshOnFocus` component (mounted in `providers.tsx`) calls `router.refresh()` when the tab/PWA becomes visible or focused, and when the Capacitor app resumes from the background (new `setupAppResume` helper) — so the Android app no longer needs a full close-and-reopen to pick up changes

### 2026-06-19: Discord integration

- An optional Discord channel webhook as a third notification surface alongside Web Push and FCM. Posts daily reminders, new group-quest invites, deadline alerts, and group-quest completions to a shared channel, @mentioning each opted-in user
- New optional `DISCORD_WEBHOOK_URL` env var; the integration is fully disabled when it's unset. New `User.discordUsername` field (a username for display, or a numeric Discord User ID for a real ping), captured at signup and editable in Settings via a `changeDiscordUsername` action
- New sender `src/lib/discord.ts`; the daily-reminder and deadline events flow through the reminder sweep, group-quest creation/invites through `createProject` / `inviteToQuest`, and completions through `toggleObjective`. All Discord delivery is best-effort and never blocks a quest action or sweep

### 2026-06-18: Android app (Capacitor)

- An optional Android wrapper built with Capacitor that connects to any QuestTracker server you enter and reuses the whole web UI. The native project is in `android/`, the first-run server picker in `native/launcher/`
- Native push via FCM as a second channel alongside Web Push: new `DeviceToken` model, `saveDeviceToken` / `deleteDeviceToken` actions, and an FCM branch in `sendPushToUser`. New optional `FCM_SERVICE_ACCOUNT_JSON` env var
- Settings gains a "Switch server" action and hides the browser-push control when running inside the app
- The fixed settings gear is offset by the device safe-area insets (with `viewport-fit=cover`) so it clears the Android status bar / notch instead of hiding behind it

### 2026-06-18: Settings button in the corner

- The settings gear now sits fixed in the top-right corner of every page for signed-in users, rendered once in the root layout, instead of living in the dashboard nav row

### 2026-06-18: More backgrounds and WebGL celebration effects

- Eight new shader backgrounds: Mystic Fireflies, Ocean Abyss, Ember, Galaxy Spiral, Sakura Drift, Synthwave, Constellations, and Rainstorm
- Fixed the frozen stars on Nebula and Deep Starfield, and made an equipped background swap live instead of only after a page reload
- Reworked Celebration FX into eight WebGL particle behaviors (Confetti Burst, Fireworks, Golden Coins, Ember Flurry, Petal Drift, Arcane Runes, Frostfall, and Sparkle Vortex), which now play on both level-ups and quest completions
- Removed color themes from the shop

### 2026-06-18: Opt out of the gem economy

- **Free cosmetics mode**: a Settings toggle (`User.cosmeticsFree`) that unlocks and equips every cosmetic without spending Quest Gems, for users who'd rather not engage with the economy. The Shop and pickers treat everything as owned while it's on. The gem balance is untouched, so toggling it back off restores normal gating

### 2026-06-18: WebGL graphics (three.js)

- **WebGL backgrounds**: shader-based ambient backdrops (living aurora, nebula, deep starfield) selectable in Settings and the Shop, added as a new `background` cosmetic category. The classic CSS aurora stays the free default; some WebGL backgrounds are free, others are gem-priced
- **GPU celebration effects**: level-up, quest-complete, and companion-evolution showers play as bloom-lit GPU particle bursts where WebGL is available
- **3D Quest Gem**: a spinning, glossy gem replaces the 💎 glyph in the Shop
- Built on three.js via react-three-fiber + drei + postprocessing, all lazy-loaded so they stay out of the initial bundle. A single capability gate (`src/lib/useWebGL.ts`) requires WebGL2 and honors `prefers-reduced-motion`, and otherwise everything falls back to the existing CSS/DOM visuals. New `User.backgroundId` column and a `free` flag on cosmetics

### 2026-06-18: Quest Gems and cosmetic Shop

- **Quest Gems** currency, earned from level-ups, achievements, and streak milestones. The balance is derived from progress (farm-proof), not a stored counter
- **Shop** (`/shop`) to buy and equip cosmetics: color themes, XP-bar styles, frames and glows, and level-up particle styles, with live previews and a nav gem-balance chip
- Themes recolor the app accent via a CSS-variable layer applied server-side (no flash). New `CosmeticUnlock` model and equipped-cosmetic columns on `User`

### 2026-06-17: Reverse-proxy and Cloudflare Tunnel support

- **`ALLOWED_ORIGINS`** env var feeding Next's `serverActions.allowedOrigins`, so mutations no longer return 500 when the proxy forwards a `Host` that differs from the browser `Origin`. Passed as a Docker build arg (baked into the standalone build). `NEXTAUTH_URL`'s host is trusted automatically

### 2026-06-17: Party member editing

- **Member edit permissions**: accepted party members can now add and edit objectives, inventory, and quest settings on a shared quest, gated by a per-quest owner toggle (set at creation or on the quest page). Checking off progress is always allowed, and deleting the quest stays owner-only. New `Project.membersCanEdit` field

### 2026-06-17: Remove allies

- **Remove party members**: either ally can remove the other from the Party page (`/party`). Removal also deletes their shared-quest memberships in both directions, fully disconnecting the two heroes

### 2026-06-17: Companion pet and reminders

- **Companion pet**: adopt a dragon, fox spirit, or slime that evolves with your level and reacts to your streak, with an evolution celebration
- **Reminders**: opt-in web push (works when the app is closed) plus an in-app alert center (`/notifications`) for come-back nudges, streak-at-risk, quest deadlines, and companion pokes. An in-process scheduler runs the sweep
- **Notification settings**: enable push per device, toggle each reminder type, and set a daily reminder time
- New `Pet`, `PushSubscription`, `Notification`, and `NotificationPreference` models

### 2026-06-17: Party and group quests

- **Party and group quests**: invite allies by unique username (accept/decline), then share quests with chosen allies who accept per quest. Shared quests have shared progress and award XP to every member on completion
- **Party page** (`/party`) collecting incoming ally requests and quest invites, with a pending-notice badge across the nav
- **Usernames** required at registration and changeable in account settings
- New `Connection` and `QuestMember` models

### 2026-06-16: Progression and planning update

- **XP & leveling** with a quadratic curve and evolving rank titles, plus a level-up celebration
- **Difficulty & rarity** (Trivial → Legendary) scaling XP rewards and card glow
- **Daily streaks** with current/longest tracking and at-risk warnings
- **Hero profile** (`/hero`) for level, XP, title, streaks, lifetime stats, and recent badges
- **Today / Agenda** (`/today`), **Calendar** (`/calendar`), and **Insights** (`/insights`, with a contribution heatmap) views
- **Tags, search & filters** on the quest board
- New `CompletionEvent` log as the source of truth for XP, streaks, and insights

### Earlier

- Ambient aurora/mote background and element animations
- **Epic Quests**: sub-quest hierarchy with optional in-order locking
- Inventory on quest creation, plus objective and quest completion effects
- **Achievements** added; inventory items became a toggle rather than a count
- Initial QuestTracker release: quests, objectives, recurrence, and authentication

## License

GNU AFFERO GENERAL PUBLIC LICENSE
                       Version 3
