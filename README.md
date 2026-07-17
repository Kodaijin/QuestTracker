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
so the app uses Firebase Cloud Messaging. Enabling it takes **both** ends —
missing either one means no device notifications (both are off by default):

1. **Firebase project** — in the [Firebase console](https://console.firebase.google.com),
   create a project and add an **Android app** with package name **`com.questtracker.app`**
   (must match `applicationId` in `android/app/build.gradle`).
2. **App side** — download that app's `google-services.json` into `android/app/`, then
   **rebuild and reinstall the app** (`npx cap sync android` + a fresh build). The file is
   compiled into the APK, so an already-installed build will never register a token until
   you rebuild. Gradle logs `google-services.json not found… Push Notifications won't work`
   when it's missing.
3. **Server side** — Firebase → **Project settings → Service accounts → Generate new
   private key**, minify the JSON to one line, and set it as `FCM_SERVICE_ACCOUNT_JSON`
   in the environment the server actually runs in. Restart the server.

Without both, the app still works; you just won't get background notifications, and the
server logs a one-time `[fcm] … FCM_SERVICE_ACCOUNT_JSON is unset or invalid` warning if
devices have registered but the credential is missing. FCM is delivered as a second
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

The changelog lives in the [`changelog/`](changelog/) folder — one Markdown file per change, named `YYYY-MM-DD-slug.md`. Add a new file there for each change instead of editing this section.
