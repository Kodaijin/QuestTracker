# Smoke Test — Runbook

## Quick start

```sh
# Ensure DATABASE_URL and NEXTAUTH_URL are set (or present in .env), then:
npm run smoke
```

The script exits 0 on full pass, 1 on any failure.  
Cleanup always runs (even after a failure), removing all `@questlog.test` accounts.

---

## What the smoke test covers

| Step | Name | Method |
|------|------|--------|
| 1 | REGISTER | `registerUser()` direct — creates test user, asserts no `passwordHash` in response |
| 2 | DUPLICATE_GUARD | `registerUser()` again with same email — asserts `{ ok: false }`, no throw |
| 3 | AUTH | HTTP `POST /api/auth/callback/credentials` — asserts session cookie issued |
| 4 | CREATE_PROJECT | Prisma direct — creates project, verifies `userId` ownership |
| 5 | TOGGLE_OBJECTIVE | Prisma direct — seeds objective, flips `isCompleted`, re-fetches to confirm durability |
| 6 | INVENTORY | Prisma direct — sets `quantity=42`, re-fetches; Zod schema rejects `qty<0` |
| 7 | OWNERSHIP | Prisma direct — verifies other user's ID fails the ownership guard query |
| 8 | CLEANUP | `prisma.user.deleteMany` cascade — removes all test data, confirms 0 rows |

> **Steps 4–7 use Prisma directly** because the project server actions call `getServerSession()`,
> which requires a live Next.js HTTP request context not available in a standalone script.
> The Zod schema check in step 6 validates the same schema wired into `updateInventoryQuantity`.

---

## Manual persistence check

This verifies that data written before a container restart survives the Docker volume.

### Run

```sh
# 1. Start the full stack
docker compose up -d

# 2. Log in and create a project, add objectives and inventory items via the UI.
#    Note the project title and a few item details.

# 3. Stop all containers (data stays in the named volume)
docker compose down

# 4. Bring the stack back up
docker compose up -d

# 5. Log in again and navigate to the same project.
#    Verify:
#      - Project title is present
#      - Objectives show the correct isCompleted state
#      - Inventory quantities match what you entered
```

### Pass criteria

All user data created in step 2 is visible and correct after the restart in step 5.  
The `entrypoint.sh` runs `prisma migrate deploy` on every start; a fresh migration must
not drop or truncate existing rows.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `AUTH` step fails with "network error" | App is not running at `NEXTAUTH_URL` |
| `AUTH:cookie` fails | `NEXTAUTH_SECRET` missing or wrong in the running app |
| `REGISTER` fails with Prisma connection error | `DATABASE_URL` points to unreachable host |
| Cleanup error printed at the end | Previous test run orphaned rows — run the manual cleanup below |

**Manual cleanup** (if the script cannot connect to clean up after itself):

```sql
DELETE FROM "User" WHERE email LIKE '%@questlog.test%';
```
