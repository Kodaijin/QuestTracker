# QuestLog

A gamified, RPG-flavored task tracker. Turn your projects into **quests**, break them into **objectives**, check off the **loot** you've gathered, **earn XP and level up your hero**, keep a **daily streak**, unlock **achievements**, and let recurring quests reset themselves on a schedule.

Built with Next.js (App Router), Prisma, PostgreSQL, and NextAuth — fully containerized with Docker.

## Features

- **Quests** — projects with a title, description, and custom icon; created with their objectives (and optional inventory) up front
- **Epic Quests** — quests whose "objectives" are full sub-quests (each with its own objectives, inventory, and page); optionally enforced **in order**, hard-locking later sub-quests (🔒) until earlier ones are complete
- **Objectives** — ordered, checkable sub-tasks that drive each quest's completion progress; every quest requires at least one
- **Inventory** — a checklist of named items needed for a quest; check each off as you gather it
- **XP & leveling** — every objective, gathered item, and completed quest awards XP (un-checking claws it back). XP drives your level, a quadratic curve, and an evolving rank title (Novice → Squire → Knight → Champion → Hero → Legend), with a level-up celebration
- **Difficulty & rarity** — tag a quest Trivial → Legendary; harder quests award more XP and glow brighter on the board
- **Daily streaks** — keep a flame going by completing something each day; tracks your current and longest streak with at-risk warnings
- **Hero profile** (`/hero`) — your home base: level, XP bar, rank title, streaks, lifetime stats, and recent badges
- **Today / Agenda** (`/today`) — active quests bucketed into Overdue, Due today, This week, and No date
- **Calendar** (`/calendar`) — a month grid plotting recurring and scheduled quests
- **Insights** (`/insights`) — a contribution heatmap, XP-over-time, completions by type, quests by difficulty, and achievement progress
- **Tags, search & filters** — tag quests for grouping, then search and filter the board by text, difficulty, or tag
- **Achievements** — 50+ cheeky badges (including streak milestones) unlocked just by using the app, tracked per user and never revoked once earned
- **Completion effects** — sparkle-and-glow feedback when you check an objective, and a golden "Quest Complete!" celebration when a quest is finished (respects `prefers-reduced-motion`)
- **Recurring quests** — daily, weekly, every N weeks, monthly, or a specific date; elapsed quests advance automatically on load
- **Authentication** — email/password accounts via NextAuth, with a security-question password reset flow
- **Custom icons** — upload and auto-resize quest icons

## Tech Stack

| Layer    | Tool                                   |
| -------- | -------------------------------------- |
| Framework| Next.js 14 (App Router, Server Actions)|
| Language | TypeScript                             |
| Database | PostgreSQL                             |
| ORM      | Prisma                                 |
| Auth     | NextAuth                               |
| Styling  | Tailwind CSS                           |
| State    | Zustand                                |
| Runtime  | Docker / Docker Compose                |

## Getting Started

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

## Environment Variables

| Variable          | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`    | PostgreSQL connection string                                       |
| `POSTGRES_USER`   | Postgres user (used by the Docker DB service)                      |
| `POSTGRES_PASSWORD`| Postgres password (used by the Docker DB service)                 |
| `POSTGRES_DB`     | Postgres database name (used by the Docker DB service)             |
| `NEXTAUTH_SECRET` | Secret used to sign NextAuth sessions — **change this**            |
| `NEXTAUTH_URL`    | Base URL of the app (e.g. `http://localhost:3000`)                 |
| `TZ`              | Timezone for quest reset / day-boundary logic (e.g. `Etc/GMT+8`)   |

See `.env.example` for a complete template.

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

## Data Model

- **User** — owns many projects, completion events, and unlocked achievements; stores credentials and an optional security question
- **Project (Quest)** — title, description, icon, `difficulty`, `tags`, recurrence settings, and due/completion dates. An Epic is a Project with `isEpic`; its sub-quests are Projects pointing back via `parentId` (with `epicOrder` for sequencing and a `sequential` flag on the Epic)
- **Objective** — ordered, completable sub-tasks belonging to a quest
- **InventoryItem** — named items belonging to a quest, each with a `gathered` checkbox state
- **CompletionEvent** — an append-only log of every objective/item/quest completion (with awarded XP and timestamp); the source of truth for XP, levels, streaks, and insights
- **UnlockedAchievement** — records which achievement a user has earned and when (unique per user + achievement key)

## License

GNU AFFERO GENERAL PUBLIC LICENSE
                       Version 3
