# QuestLog — Sequential Agent Prompt Pack

Copy-paste-ready prompts, one per task, in strict execution order. Each is **context-isolated**
(assume the agent has no memory of prior steps — the prompt re-states what already exists).
A **model recommendation** is given per task: Haiku for mechanical/boilerplate work, Sonnet where
schema design, auth wiring, or type-flow reasoning matters.

The shared guardrail block is repeated in every prompt by design — do not strip it when pasting.

## Execution order
1. **1.1** — Docker & env
2. **1.2** — Prisma schema
3. **2.1** — NextAuth login config
4. **2.1b** — Registration flow
5. **2.2** — Server actions (data layer)
6. **3.1** — UI primitives
7. **3.2** — Store & pages
8. **4.1** — Production Dockerfile
9. **5** — End-to-end smoke test
10. **6** — Edit controls (rename quest, CRUD objectives & inventory)

> Note: Prompt 6 is a feature addition layered on top of the Sprint 1–4 build. If you run it,
> re-run Prompt 5's smoke test afterward and extend it to cover the new actions.

---

## 🟢 PROMPT 1.1 — Multi-Container Setup & Environment Config
**Recommended model: Haiku** (pure boilerplate / config authoring)

```
ROLE & CONTEXT
You are a DevOps engineer working on "QuestLog", a self-hosted gamified task manager.
You are in Sprint 1, Task 1.1: Local Infrastructure ONLY. The app code does not exist yet —
you are only creating container orchestration and environment scaffolding. The project root
is `questlog/`. Stack: Next.js 14 (App Router, standalone), PostgreSQL 16, Prisma, NextAuth.

YOUR TASK — create exactly these three files and nothing else:

1. docker-compose.yml
   - Service `db`: image `postgres:16-alpine`.
     - Map a NAMED VOLUME `questlog_pgdata` to `/var/lib/postgresql/data` for persistence.
     - Read POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB from environment.
     - Expose port 5432.
     - Add a healthcheck using `pg_isready`.
   - Service `app`: a PLACEHOLDER only.
     - Reference `build: .` (Dockerfile does not exist yet — that is expected, do not create it).
     - `depends_on` db with `condition: service_healthy`.
     - Map port 3000:3000.
     - Pass `DATABASE_URL` and `NEXTAUTH_SECRET` env through.
   - Declare the named volume at the bottom.

2. .env.example
   - DATABASE_URL (postgres connection string using the service name `db` as host)
   - POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
   - NEXTAUTH_SECRET (placeholder), NEXTAUTH_URL=http://localhost:3000
   - Use clearly fake placeholder values, never real secrets.

3. .gitignore
   - node_modules, .next, .env (but NOT .env.example), npm-debug logs,
     /prisma/migrations is KEPT (do not ignore it), generated Prisma client if applicable.

STRICT GUARDRAILS
- Do NOT create the Dockerfile, package.json, Prisma schema, or any src/ files. Those are future tasks.
- Do NOT invent app source. The `app` service is a forward-reference placeholder only.
- No "TODO" comments, no half-written stanzas. Every line you write must be valid and final.
- Use exact image tags as specified (postgres:16-alpine).

DEFINITION OF DONE (verify before proceeding)
- `docker compose config` parses with no errors.
- `docker compose up db` starts Postgres and the healthcheck reaches "healthy".
- `.env.example` copies cleanly to `.env` and contains every variable the compose file references.
```

---

## 🟢 PROMPT 1.2 — Prisma Schema & Declarative Models
**Recommended model: Sonnet** (relational modeling + cascade correctness matters)

```
ROLE & CONTEXT
You are a database engineer on "QuestLog", a self-hosted gamified task manager.
You are in Sprint 1, Task 1.2: Database Schema ONLY. A docker-compose.yml with a PostgreSQL 16
service already exists. There is no Prisma setup yet. Do not touch Docker or write app code.

YOUR TASK
1. Add Prisma as a dev dependency and `@prisma/client` as a dependency (state the exact
   `npm install` commands; create/extend package.json minimally if needed for these deps only).
2. Create `prisma/schema.prisma`:
   - datasource: provider `postgresql`, url from env("DATABASE_URL").
   - generator: prisma-client-js.
   - Models:
     • User: id (cuid), email (unique), passwordHash (String), name (String?),
       createdAt. Relation: projects.
     • Project: id (cuid), title, description?, userId FK -> User.
       Relation to objectives and inventoryItems. createdAt/updatedAt.
     • Objective (subtask): id, title, isCompleted (Boolean @default(false)),
       order (Int — explicit sort position), projectId FK -> Project.
     • InventoryItem: id, name, quantity (Int @default(0)), projectId FK -> Project.
   - CASCADE RULES (critical):
     • Deleting a User cascades to their Projects.
     • Deleting a Project cascades to its Objectives AND InventoryItems.
     • Use `onDelete: Cascade` on the relation fields.
   - Add `@@index` on every foreign key column.

STRICT GUARDRAILS
- TypeScript/Prisma must be fully type-safe. No `Json`/untyped escape hatches.
- Do NOT add models, fields, or auth tables not listed above (no XP, levels, sessions, etc. — future scope).
- Do NOT run destructive resets. Do NOT write seed scripts.
- No placeholder comments or "// fill in later".

DEFINITION OF DONE
- `npx prisma format` reports the schema is valid and leaves it formatted.
- `npx prisma validate` passes.
- `npx prisma migrate dev --name init` generates a migration and applies it to the running db container.
- `npx prisma generate` produces a typed client with User, Project, Objective, InventoryItem.
```

---

## 🟢 PROMPT 2.1 — Local NextAuth.js Configuration
**Recommended model: Sonnet** (auth wiring is high-risk, easy to get subtly wrong)

```
ROLE & CONTEXT
You are a backend engineer on "QuestLog" (Next.js 14 App Router, self-hosted).
Sprint 2, Task 2.1: Authentication ONLY. A valid `prisma/schema.prisma` exists with models
User(id, email unique, passwordHash, name?), Project, Objective, InventoryItem, and a generated
Prisma client. No auth code exists yet. Do not build UI or server actions.

YOUR TASK
1. Create `src/lib/prisma.ts`:
   - Export a SINGLE globally-cached PrismaClient singleton to survive Next.js hot reload.
   - Use the `globalThis` pattern; only cache in non-production.
   - Strongly typed — no `any`.

2. Install: next-auth, bcryptjs, and @types/bcryptjs (state exact npm commands).

3. Create the App Router NextAuth handler at `src/app/api/auth/[...nextauth]/route.ts`:
   - Define `authOptions` (export it so future server code can import it).
   - Use CredentialsProvider with fields email + password.
     • In `authorize`: look up the user by email via the Prisma singleton, compare the
       submitted password to passwordHash using `bcryptjs.compare`.
     • Return a typed user object on success, null on failure. Never throw raw on bad creds.
   - session strategy: "jwt".
   - Wire jwt + session callbacks so `session.user.id` is populated and typed.
   - Export `const handler = NextAuth(authOptions)` and re-export as `{ handler as GET, handler as POST }`.
   - If module augmentation is needed to add `id` to Session/User types, add it in a `.d.ts`
     or inline `declare module "next-auth"` — fully typed, no `any`.

STRICT GUARDRAILS
- Absolutely no `any`. Type the authorize return and callbacks explicitly.
- Do NOT implement sign-up, registration, password reset, or UI — out of scope for this task.
- Do NOT use the Prisma adapter together with a jwt CredentialsProvider session if it conflicts;
  if you include @next-auth/prisma-adapter, ensure it is compatible with the jwt strategy, otherwise
  omit it and rely on the credentials + jwt flow. State which choice you made and why in one comment line.
- No TODOs, no stubbed authorize that returns a hardcoded user.

DEFINITION OF DONE
- `npx tsc --noEmit` passes with zero errors.
- `next build` compiles the route without type errors.
- Hitting `/api/auth/providers` returns JSON listing the credentials provider.
- `session.user.id` is typed (no TS error when accessed in a downstream file).
```

---

## 🟢 PROMPT 2.1b — User Registration Flow (Sign-Up)
**Recommended model: Sonnet** (password hashing + zod + form/server-action boundary — security-sensitive)

**Placement:** Run after Prompt 2.1 (reuses the Prisma singleton and pairs with the login flow)
and before Prompt 2.2. Closes the gap where no user can ever be created to log in with.

```
ROLE & CONTEXT
You are a backend + frontend engineer on "QuestLog" (Next.js 14 App Router, self-hosted).
This is the Registration task, run between Sprint 2 Task 2.1 (NextAuth login) and Task 2.2
(server actions). The following already exist and MUST be reused as-is:
- `src/lib/prisma.ts` (Prisma singleton).
- `src/app/api/auth/[...nextauth]/route.ts` exporting `authOptions`, using CredentialsProvider
  that compares the submitted password against User.passwordHash via bcryptjs.
- Prisma model User(id, email @unique, passwordHash, name?, createdAt).
- UI primitives Button/Card may exist (Sprint 3) — if `src/components/ui/` is NOT yet present,
  use plain Tailwind-styled native elements and DO NOT import from it.
Do not modify the schema, authOptions, or existing login behavior.

YOUR TASK
1. Create a registration server action at `src/app/actions/auth.ts`:
   - First line: `"use server";`
   - Reuse bcryptjs (already installed in Task 2.1) and zod (install zod if absent — state command).
   - Export `registerUser(input)`:
     • zod schema: email (valid email), password (min 8 chars), name (optional, trimmed).
     • Normalize email to lowercase before lookup/insert.
     • Reject if a User with that email already exists — return a typed, user-safe error result
       (do NOT throw a raw DB unique-constraint error to the client; catch and translate it).
     • Hash the password with `bcryptjs.hash` (salt rounds 10–12). NEVER store the plaintext.
     • Create the User and return ONLY a safe shape: { id, email, name } — never return passwordHash.
   - Return type: a discriminated union, e.g.
     `{ ok: true; user: { id: string; email: string; name: string | null } }
      | { ok: false; error: string }`. Fully typed — no `any`.

2. Create the sign-up page at `src/app/register/page.tsx`:
   - A `"use client"` form (email, password, optional name) that calls `registerUser`.
   - On `ok: true`: immediately call NextAuth `signIn("credentials", { email, password,
     redirect: true, callbackUrl: "/" })` so the new user lands on the dashboard logged in.
   - On `ok: false`: render the returned error message inline; do not crash.
   - Disable the submit button while pending; show basic client-side required validation.

3. (Optional, only if no login UI exists yet) create `src/app/login/page.tsx`:
   - A minimal `"use client"` form that calls `signIn("credentials", ...)` and links to /register.
   - If a login page already exists, SKIP this and just ensure /register links to it.

STRICT GUARDRAILS
- Absolutely no `any`. Inputs typed via `z.infer`; return via the discriminated union above.
- NEVER log, return, or render the plaintext password or the passwordHash.
- Do NOT weaken or alter the existing CredentialsProvider / authOptions.
- Do NOT add email verification, OAuth providers, rate limiting, captcha, or password-reset —
  out of scope. No roles/permissions beyond the existing User model.
- Handle the duplicate-email case gracefully (translated error), not via an uncaught 500.
- No TODOs, no stubbed success that skips hashing, no mock responses.

DEFINITION OF DONE
- `npx tsc --noEmit` and `next build` both pass with zero errors.
- Submitting /register with a NEW email creates a User row whose passwordHash is a bcrypt hash
  (starts with `$2`), then auto-signs-in and redirects to `/`.
- Submitting the SAME email again shows the inline "already exists" error — no 500, no crash.
- The newly registered account can log out and log back in via the existing credentials flow.
- `registerUser`'s return value contains no passwordHash field (verify the type and the payload).
```

---

## 🟢 PROMPT 2.2 — Server Actions (Data Access Layer)
**Recommended model: Sonnet** (zod + auth + type-safe return contracts)

```
ROLE & CONTEXT
You are a backend engineer on "QuestLog" (Next.js 14 App Router, self-hosted).
Sprint 2, Task 2.2: Server Actions ONLY. The following already exist and must be reused:
- `src/lib/prisma.ts` (Prisma singleton)
- `src/app/api/auth/[...nextauth]/route.ts` exporting `authOptions`
- Prisma models User, Project, Objective(order, isCompleted), InventoryItem(quantity).
Do not modify auth or schema. Do not build UI.

YOUR TASK
Create `src/app/actions/projects.ts`:
- First line: `"use server";`
- Install zod if not present (state the command).
- Add a private helper `requireUserId()` that calls `getServerSession(authOptions)` and returns
  the typed user id, or throws an Error("Unauthorized") if absent.
- Implement these four EXPORTED async actions. Each validates input with a zod schema and is
  scoped so a user can only touch their own data (verify ownership via userId before mutating):

  1. createProject(input): title required, description optional. Creates Project owned by the
     current user. Returns the created Project (typed).
  2. toggleObjective(input): objectiveId. Flips isCompleted. Must confirm the objective belongs
     to a project owned by the current user before updating.
  3. updateInventoryQuantity(input): itemId, quantity (Int, min 0). Ownership-checked update.
  4. getProjectsForUser(): returns the current user's projects including objectives (sorted by
     `order` asc) and inventoryItems. Typed return.

STRICT GUARDRAILS
- No `any`. Derive types from zod (`z.infer`) and Prisma's generated types.
- Every mutating action MUST enforce ownership — no action may operate on another user's row.
- Validate ALL inputs with zod and return/throw a clear error on parse failure.
- Do NOT add caching, revalidatePath wiring to specific UI routes, optimistic logic, or extra
  actions beyond the four listed. No TODOs or stubs.

DEFINITION OF DONE
- `npx tsc --noEmit` passes.
- `next build` compiles the actions module.
- Each action has an explicit, non-`any` return type that matches its Prisma query shape.
- Calling any action without a session throws "Unauthorized" (reason it through; no manual test needed).
```

---

## 🟢 PROMPT 3.1 — Component Library Scaffolding (shadcn style)
**Recommended model: Haiku** (mechanical primitive generation)

```
ROLE & CONTEXT
You are a frontend engineer on "QuestLog" (Next.js 14 App Router, Tailwind CSS).
Sprint 3, Task 3.1: UI primitives ONLY. Tailwind is assumed configured. No design system exists yet.
Do not build pages, stores, or wire data — only reusable primitives.

YOUR TASK
1. Create `src/lib/utils.ts`:
   - Install clsx and tailwind-merge (state command).
   - Export `cn(...inputs: ClassValue[])` merging via clsx + twMerge. Fully typed.

2. Create shadcn-style primitives, each as its own file under `src/components/ui/`:
   - button.tsx  — variants (default, outline, ghost, destructive) + sizes, using cva if you
     install it, otherwise a typed variant map. forwardRef, typed props extending native element.
   - card.tsx    — Card, CardHeader, CardTitle, CardContent, CardFooter subcomponents.
   - checkbox.tsx — accessible controlled checkbox (label + checked/onCheckedChange typed props).
   - progress.tsx — a value (0–100) driven progress bar rendered with Tailwind width.

STRICT GUARDRAILS
- No `any`. All component props extend the correct React/HTML element types and use forwardRef
  where a ref would be expected.
- Use `cn()` for all className composition.
- These are STYLING-READY PRIMITIVES ONLY — no business logic, no data fetching, no store imports,
  no app-specific text. Do not build the dashboard or project page.
- No TODOs, no empty render bodies.

DEFINITION OF DONE
- `npx tsc --noEmit` passes.
- Each component imports `cn` from `src/lib/utils.ts` and renders without runtime errors.
- Importing Button/Card/Checkbox/Progress into a scratch page compiles cleanly.
```

---

## 🟢 PROMPT 3.2 — Zustand Store & Front-End Pages
**Recommended model: Sonnet** (state + optimistic flow + server-action wiring)

```
ROLE & CONTEXT
You are a frontend engineer on "QuestLog" (Next.js 14 App Router).
Sprint 3, Task 3.2: Client store + pages. These already exist and MUST be reused as-is:
- Server actions in `src/app/actions/projects.ts`: createProject, toggleObjective,
  updateInventoryQuantity, getProjectsForUser.
- UI primitives in `src/components/ui/`: Button, Card, Checkbox, Progress.
- Prisma types for Project/Objective/InventoryItem.
Do not edit actions, schema, or primitives. Do not write the Dockerfile.

YOUR TASK
1. Install zustand. Create `src/store/useProjectStore.ts`:
   - Holds local layout/UI state plus an optimistic copy of the user's projects.
   - Typed state (derive entity types from Prisma's generated types — no `any`).
   - Actions: hydrate(projects), optimisticToggleObjective(objectiveId),
     optimisticSetQuantity(itemId, qty), and rollback helpers if a server call fails.

2. `src/app/page.tsx` — Dashboard summary (Server Component that fetches via getProjectsForUser,
   then renders a client child). Show each project as a Card with a Progress bar computed from
   completed objectives / total. Link each card to `/projects/[id]`.

3. `src/app/projects/[id]/page.tsx` — Project Workspace:
   - Server-fetch the project (reuse getProjectsForUser or filter by id; ownership already enforced).
   - Render the objective checklist using Checkbox; toggling calls the store's optimistic update
     THEN the toggleObjective server action, rolling back on failure.
   - Render an inventory "ledger" with quantity controls calling updateInventoryQuantity the same way.

STRICT GUARDRAILS
- No `any`. Props, store, and action results all typed via Prisma/zod-inferred types.
- Respect the Server/Client component boundary: mark interactive components `"use client"`,
  keep data-fetching in Server Components, never import server actions into a place that breaks the boundary.
- Do NOT add new server actions, new DB fields, routing, or auth pages. Use only what exists.
- No TODOs, no `<div>placeholder</div>`, no mock data — render real fetched data.

DEFINITION OF DONE
- `npx tsc --noEmit` and `next build` both pass.
- Dashboard lists real projects with an accurate progress bar.
- Toggling an objective updates the UI instantly (optimistic) and persists after refresh.
- Changing an inventory quantity persists after refresh; a forced server error rolls the UI back.
```

---

## 🟢 PROMPT 4.1 — Production Dockerfile & Standalone Compilation
**Recommended model: Sonnet** (multi-stage build correctness + migration-on-boot)

```
ROLE & CONTEXT
You are a release engineer on "QuestLog" (Next.js 14 App Router, Prisma, PostgreSQL 16).
Sprint 4, Task 4.1: Production containerization. The full app already exists (auth, server actions,
store, pages, Prisma schema + migrations). A docker-compose.yml with `db` and a placeholder `app`
service already exists. Do not change app feature code.

YOUR TASK
1. Update (or create) `next.config.js` to set `output: 'standalone'`. Keep existing config intact.

2. Create a multi-stage `Dockerfile` (node:20-alpine base):
   - Stage `deps`: install production dependencies using the lockfile only (cache-friendly).
   - Stage `builder`: copy source, run `npx prisma generate`, then `next build`
     (produces `.next/standalone`).
   - Stage `runner`:
     • Minimal image, NODE_ENV=production, non-root user.
     • Copy `.next/standalone`, `.next/static`, `public`, and the `prisma/` directory
       (schema + migrations) plus the generated client / node prisma CLI needed for deploy.
     • EXPOSE 3000.

3. Add an entrypoint that runs `npx prisma migrate deploy` and ONLY on success starts the node
   server (`node server.js`). Use a small entrypoint script (or compose command) so migrations
   run immediately before the process boots. If migrate fails, the container must exit non-zero.

4. Update the compose `app` service to use this image/build and pass DATABASE_URL + NEXTAUTH_SECRET.

STRICT GUARDRAILS
- Multi-stage only — the final image must NOT contain dev dependencies or source it doesn't need.
- Do NOT bake secrets into the image; they come from env at runtime.
- `migrate deploy` ONLY (never `migrate dev`/`db push`/reset) — production data is sacred.
- No TODOs, no commented-out stages. Every stage must build.

DEFINITION OF DONE
- `docker compose build app` completes with no errors.
- `docker compose up` starts db, runs `prisma migrate deploy` (visible in logs), then serves on :3000.
- The app loads, login works, and data persists across `docker compose down && up` (volume intact).
- Final image size is materially smaller than a single-stage build (standalone output confirmed).
```

---

## 🟢 PROMPT 5 — End-to-End Smoke-Test Harness
**Recommended model: Sonnet** (cross-cutting verification; must reason about the whole stack)

**Placement:** Run last, after Prompt 4.1. The single repeatable pass that proves the whole build works.

```
ROLE & CONTEXT
You are a QA / release engineer on "QuestLog" (Next.js 14 App Router, Prisma, PostgreSQL 16,
NextAuth credentials). The full application is built and containerized. Your job is to create a
repeatable end-to-end smoke test that exercises the entire critical path. You are NOT adding
features — only verification tooling. Reuse what exists; change app feature code ONLY if the test
surfaces a real defect, and if so, report it explicitly.

Existing surface you may rely on:
- Registration server action `registerUser` in `src/app/actions/auth.ts`.
- Project actions in `src/app/actions/projects.ts`: createProject, toggleObjective,
  updateInventoryQuantity, getProjectsForUser.
- NextAuth credentials login at `/api/auth/...`, pages /register, /login, /, /projects/[id].
- Prisma singleton at `src/lib/prisma.ts`; models User/Project/Objective/InventoryItem.

YOUR TASK
Create a smoke-test harness as a standalone TypeScript script at `scripts/smoke-test.ts`,
runnable via an npm script `npm run smoke`. It must run against the live app + db
(reading DATABASE_URL / NEXTAUTH_URL from env) and cover, in order:

  1. REGISTER: create a unique test user (email like `smoke+<timestamp>@questlog.test`).
     Assert the returned shape has { id, email } and NO passwordHash.
  2. DUPLICATE GUARD: call registration again with the same email; assert a graceful
     { ok: false } error (no throw / no 500).
  3. AUTH: authenticate as the test user (POST the credentials flow against /api/auth/callback/credentials,
     capturing the session cookie) OR, if direct-action testing is cleaner, call the server actions
     within an authenticated context. Assert an authenticated session is obtained.
  4. CREATE PROJECT: createProject with a title; assert it returns a Project owned by the user.
  5. SEED + TOGGLE: ensure the project has at least one Objective, then toggleObjective;
     re-fetch via getProjectsForUser and assert isCompleted flipped.
  6. INVENTORY: ensure an InventoryItem exists, updateInventoryQuantity to a known value,
     re-fetch and assert quantity persisted; assert quantity < 0 is rejected by validation.
  7. OWNERSHIP: attempt an action against an id NOT owned by the test user; assert it is denied.
  8. CLEANUP: delete the test user (cascade removes their projects/objectives/inventory) so the
     harness is idempotent and re-runnable.

Print a clear PASS/FAIL line per step and exit non-zero if ANY step fails.

Also document a manual PERSISTENCE check in `scripts/SMOKE.md` (not automated, since it spans a
container restart): run smoke → `docker compose down` → `docker compose up` → confirm the seeded
data created before cleanup survived a restart (volume intact).

STRICT GUARDRAILS
- No `any`. Type every assertion against Prisma/zod-inferred types. Use the existing actions and
  Prisma singleton — do NOT bypass them with raw SQL except for final cascade-cleanup verification.
- The harness MUST be idempotent: never leave orphaned test users/rows behind on success.
- Do NOT point the test at production data; it reads DATABASE_URL from env and uses uniquely
  namespaced `*@questlog.test` accounts only.
- No TODOs, no skipped/"pending" steps, no mock data standing in for a real DB round-trip.
- If a step legitimately fails because of an app bug, STOP, report the exact failing step and the
  observed vs expected, and propose the minimal fix — do not paper over it.

DEFINITION OF DONE
- `npx tsc --noEmit` passes for the script.
- `npm run smoke` against a running stack prints PASS for all 8 steps and exits 0.
- Re-running `npm run smoke` immediately afterward also passes (proves idempotent cleanup).
- Following `scripts/SMOKE.md` confirms data persists across a `docker compose down && up`.
```

---

## 🟢 PROMPT 6 — Edit Controls: Rename Quest + CRUD Objectives & Inventory
**Recommended model: Sonnet** (extends the data layer AND the UI with ownership-checked mutations + optimistic state)

**Placement:** Run after the full Sprint 1–4 build exists. This is a feature addition, not a fix.
After it, re-run Prompt 5's smoke test and extend it to cover the new actions.

```
ROLE & CONTEXT
You are a full-stack engineer on "QuestLog" (Next.js 14 App Router, Prisma, PostgreSQL 16,
NextAuth credentials, Zustand, Tailwind + shadcn-style primitives). This is a feature task:
add EDIT controls so a user can rename a quest (Project), and fully manage (add / rename / delete)
its Objectives and Inventory items via inline editing.

The following already exist and MUST be reused as-is:
- `src/lib/prisma.ts` (Prisma singleton).
- `src/app/api/auth/[...nextauth]/route.ts` exporting `authOptions`.
- `src/app/actions/projects.ts` with a `requireUserId()` helper and actions:
  createProject, toggleObjective, updateInventoryQuantity, getProjectsForUser.
- Prisma models: Project(title, description?), Objective(title, isCompleted, order, projectId),
  InventoryItem(name, quantity, projectId). Cascade deletes already configured.
- `src/store/useProjectStore.ts` (optimistic project cache).
- UI primitives in `src/components/ui/`: Button, Card, Checkbox, Progress.
- Pages `src/app/page.tsx` and `src/app/projects/[id]/page.tsx`.

Do NOT modify the Prisma schema (every field you need already exists). Do NOT touch auth.

YOUR TASK — PART A: extend `src/app/actions/projects.ts` with these EXPORTED actions.
Each validates input with zod, calls `requireUserId()`, and verifies ownership (the target row
must belong, directly or via its parent Project, to the current user) BEFORE mutating:

  Quest:
  1. updateProject(input): projectId, title (required, trimmed, non-empty), description? .
     Renames/updates the owned project. Returns the updated Project (typed).

  Objectives:
  2. createObjective(input): projectId, title. Appends with `order` = current max order + 1
     (compute it; do not hardcode). Returns the created Objective.
  3. updateObjective(input): objectiveId, title (required, non-empty). Renames only — do NOT
     touch isCompleted here (toggleObjective owns that). Ownership via parent project.
  4. deleteObjective(input): objectiveId. Ownership-checked delete.

  Inventory:
  5. createInventoryItem(input): projectId, name, quantity? (Int, min 0, default 0).
     Returns the created item.
  6. renameInventoryItem(input): itemId, name (required, non-empty). Rename only — quantity is
     owned by the existing updateInventoryQuantity action.
  7. deleteInventoryItem(input): itemId. Ownership-checked delete.

YOUR TASK — PART B: wire the UI on `src/app/projects/[id]/page.tsx` with INLINE editing.
- Quest title: a pencil/edit affordance next to the title turns it into an input with Save/Cancel
  (Escape cancels, Enter saves). On save, call updateProject.
- Each Objective row: edit (inline rename) + delete buttons alongside the existing Checkbox.
  Plus an "Add objective" input/button at the bottom of the checklist calling createObjective.
- Each Inventory row: edit (inline rename) + delete buttons alongside the existing quantity control.
  Plus an "Add item" input/button calling createInventoryItem.
- All mutations go through the Zustand store optimistically THEN the server action, rolling back
  on failure (follow the existing optimistic pattern). Extend `useProjectStore.ts` with the
  needed optimistic add/rename/delete/updateProject reducers + rollback helpers.

STRICT GUARDRAILS
- No `any`. Inputs typed via `z.infer`; returns via Prisma's generated types; store fully typed.
- Every new action MUST enforce ownership — a user can never edit/delete another user's row.
  Confirm the parent Project's userId before mutating child Objectives/InventoryItems.
- Reuse existing primitives and the existing optimistic/rollback pattern — do NOT introduce a new
  state library, a Dialog/modal, or a form library. Inline editing only.
- Do NOT add new Prisma fields/models, new routes, drag-to-reorder, or bulk edit — out of scope.
- Respect the Server/Client boundary: keep data fetching in the Server Component, mark the
  interactive editing pieces `"use client"`.
- No TODOs, no stubbed handlers, no mock data. Empty/whitespace titles must be rejected
  (both zod server-side AND a disabled Save button client-side).

DEFINITION OF DONE
- `npx tsc --noEmit` and `next build` both pass with zero errors.
- Renaming a quest persists after refresh; the dashboard card reflects the new name.
- Adding, renaming, and deleting an Objective each update instantly (optimistic) and persist after
  refresh; deleting also removes it from the Progress bar's total.
- Adding, renaming, and deleting an Inventory item each persist after refresh.
- A forced server error on any edit rolls the UI back to the prior value.
- Attempting any action against an id you don't own is rejected server-side (reason it through).
- Saving an empty/whitespace title is blocked client-side and rejected server-side.
```

---

# ▶️ How to Start the App

Two ways to run QuestLog: **production-style (full Docker)** for the real deployment, and
**dev mode (DB in Docker, app on host)** for fast iteration.

## One-time setup
```powershell
# From the questlog/ project root
copy .env.example .env          # then edit .env with real-ish values
```
Fill in `.env`:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — your local Postgres creds.
- `DATABASE_URL` — must use host `db` for the containerized app, e.g.
  `postgresql://USER:PASSWORD@db:5432/DBNAME?schema=public`
- `NEXTAUTH_URL=http://localhost:3000`
- `NEXTAUTH_SECRET` — generate one:
  ```powershell
  # PowerShell: 32 random bytes, base64
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
  ```

## Option A — Full production stack (recommended for a real run)
Builds the standalone image and runs `prisma migrate deploy` automatically on boot (from Prompt 4.1).
```powershell
docker compose up --build
```
- App: **http://localhost:3000**
- First visit → go to **/register**, create an account, you're logged in.
- Stop: `Ctrl+C`, then `docker compose down`
- Data **persists** in the `questlog_pgdata` volume across `down`/`up`.
- ⚠️ `docker compose down -v` deletes the volume (wipes all data) — only for a clean reset.

## Option B — Dev mode (fast hot-reload)
Run only Postgres in Docker; run Next.js on your host.
```powershell
# 1. Start just the database
docker compose up -d db

# 2. Point DATABASE_URL at localhost (dev only):
#    postgresql://USER:PASSWORD@localhost:5432/DBNAME?schema=public

# 3. Install deps + apply schema
npm install
npx prisma migrate dev        # creates/applies migrations against the running db
npx prisma generate

# 4. Start the dev server
npm run dev
```
- App with hot reload: **http://localhost:3000**

> Host difference: the **containerized** app talks to Postgres at host `db` (Docker network);
> the **host** dev server talks to it at `localhost`. Keep a separate `DATABASE_URL` value for each.

## Verify it's all working
```powershell
# With the stack running:
npm run smoke        # runs Prompt 5's end-to-end harness — expect 8x PASS
```

## Common issues
| Symptom | Fix |
|---|---|
| App can't reach DB in Docker | `DATABASE_URL` host must be `db`, not `localhost` |
| Dev server can't reach DB | `DATABASE_URL` host must be `localhost`, not `db` |
| "relation does not exist" | Migrations didn't run — `npx prisma migrate dev` (dev) or check entrypoint logs (prod) |
| Login always fails | `NEXTAUTH_SECRET` unset, or registered against a different DB than you're logging into |
| Port 3000 busy | Stop the other process or remap `3000:3000` in `docker-compose.yml` |
