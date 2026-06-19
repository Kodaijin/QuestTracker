# QuestTracker

A gamified, RPG-flavored task tracker. Turn your projects into quests, break them into objectives, check off the loot you've gathered, earn XP to level up your hero, keep a daily streak, unlock achievements, and let recurring quests reset themselves on a schedule.

Built with Next.js (App Router), Prisma, PostgreSQL, and NextAuth, and fully containerized with Docker.

## Features

- **Quests**: projects with a title, description, and custom icon, created with their objectives (and optional inventory) up front
- **Epic Quests**: quests whose "objectives" are full sub-quests (each with its own objectives, inventory, and page), optionally enforced in order so later sub-quests stay locked (🔒) until earlier ones are complete
- **Objectives**: ordered, checkable sub-tasks that drive each quest's completion progress. Every quest needs at least one
- **Inventory**: a checklist of named items a quest needs. Check each off as you gather it
- **XP & leveling**: every objective, gathered item, and completed quest awards XP, and un-checking claws it back. XP drives your level along a quadratic curve and an evolving rank title (Novice → Squire → Knight → Champion → Hero → Legend), with a level-up celebration
- **Difficulty & rarity**: tag a quest Trivial → Legendary. Harder quests award more XP and glow brighter on the board
- **Daily streaks**: keep a flame going by completing something each day. Tracks your current and longest streak with at-risk warnings
- **Hero profile** (`/hero`): your home base for level, XP bar, rank title, streaks, lifetime stats, and recent badges
- **Today / Agenda** (`/today`): active quests bucketed into Overdue, Due today, This week, and No date
- **Calendar** (`/calendar`): a month grid plotting recurring and scheduled quests
- **Insights** (`/insights`): a contribution heatmap, XP over time, completions by type, quests by difficulty, and achievement progress
- **Tags, search & filters**: tag quests for grouping, then search and filter the board by text, difficulty, or tag
- **Achievements**: 50+ cheeky badges (including streak milestones) unlocked just by using the app, tracked per user and never revoked once earned
- **Completion effects**: a quick sparkle and glow when you check an objective, and a "Quest Complete!" celebration when a quest is finished. On level-ups, quest completions, and companion evolutions the celebration plays as a WebGL particle burst with bloom where WebGL is available, and falls back to the CSS effect otherwise. All of it respects `prefers-reduced-motion`
- **Recurring quests**: daily, weekly, every N weeks, monthly, or a specific date. Elapsed quests advance automatically on load
- **Party & group quests** (`/party`): add allies by unique username (they accept or decline), then share a quest with chosen allies when you create it. Invited heroes accept per invite. Once joined, the party shares the same progress and every member earns XP when it's completed. Members can always check off shared progress, and the owner can let members edit the quest too (objectives, inventory, and settings) with a per-quest toggle. Only the owner can delete it. Either ally can remove the other at any time, which also severs their shared-quest memberships in both directions. A notice badge in the nav surfaces pending ally requests and quest invites
- **Companion pet**: adopt a companion from a wide roster (cat, dragon, fox spirit, dog, owl, penguin, unicorn, and more) on your hero page. It evolves as you level up (Egg → Hatchling → Juvenile → Adult → Mythic) and reacts to your streak with a mood, and each evolution gets its own celebration
- **Reminders** (`/notifications`): opt-in web push notifications (delivered even when the app is closed) plus an in-app alert center for come-back nudges, streak-at-risk warnings, approaching quest deadlines, and a "your companion misses you" poke. Per-type toggles and a daily reminder time live in Settings
- **Quest Gems & Shop** (`/shop`): earn 💎 gems by leveling up, unlocking achievements, and hitting streak milestones, then spend them on cosmetics: animated XP-bar styles, frames and glows for your hero panel, WebGL celebration effects, and WebGL backgrounds. The gem balance is derived from your (farm-proof) progress, so it can't be cheesed by toggling quests. A spinning 3D gem-balance chip lives in the nav
- **Backgrounds**: pick your ambient backdrop in Settings or the Shop. The classic CSS aurora is the free default. A dozen WebGL backgrounds (living aurora, nebula, galaxy, ocean, synthwave, rainstorm, and more) render as shaders, some free and some gem-priced. They fall back to the CSS aurora on devices without WebGL or with `prefers-reduced-motion`
- **Free cosmetics mode**: if you'd rather skip the gem economy, a Settings toggle unlocks every cosmetic for free, so you can equip any XP bar, frame, celebration effect, or background without earning or spending Quest Gems
- **Authentication**: email/password accounts via NextAuth, each with a unique username for party invites and a security-question password reset flow
- **Custom icons**: upload and auto-resize quest icons

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

## Data model

- **User**: owns many projects, completion events, and unlocked achievements. Stores credentials, a unique `username` (used for party invites), and an optional security question
- **Project (Quest)**: title, description, icon, `difficulty`, `tags`, recurrence settings, and due/completion dates. An Epic is a Project with `isEpic`; its sub-quests are Projects pointing back via `parentId` (with `epicOrder` for sequencing and a `sequential` flag on the Epic)
- **Objective**: ordered, completable sub-tasks belonging to a quest
- **InventoryItem**: named items belonging to a quest, each with a `gathered` checkbox state
- **CompletionEvent**: an append-only log of every objective/item/quest completion (with awarded XP and timestamp). The source of truth for XP, levels, streaks, and insights
- **UnlockedAchievement**: records which achievement a user earned and when (unique per user + achievement key)
- **Connection**: a hero-to-hero ally link between a requester and addressee, with a pending/accepted/declined status (one per pair)
- **QuestMember**: a per-quest invite linking a quest to an invited user (the owner stays `Project.userId`), with a pending/accepted/declined status. Accepted members share progress and earn XP. `Project.membersCanEdit` controls whether accepted members may edit the quest or only check off progress
- **Pet**: a user's companion (species + name). Its stage and mood are derived at read time from level and streak, so nothing else is stored
- **PushSubscription**: a browser Web Push endpoint registered by a user for notifications
- **Notification**: in-app alert history and the source of truth for push de-duplication (unique per user + type + key)
- **NotificationPreference**: per-user reminder toggles and the daily reminder hour
- **CosmeticUnlock**: a cosmetic the user bought with gems (ownership only). The gem balance is derived as `earned − sum(owned prices)`, never stored as a counter. Equipped selections live on `User` (`themeId`/`xpBarId`/`frameId`/`particleId`/`backgroundId`), and the catalog and economy are code-defined in `src/lib/cosmetics.ts`. Free cosmetics (such as the default backgrounds) can be equipped without a purchase, and the per-user `cosmeticsFree` flag unlocks everything for users who opt out of the gem economy

## Changelog

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
