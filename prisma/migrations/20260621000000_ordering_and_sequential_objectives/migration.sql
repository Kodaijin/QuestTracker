-- AlterTable: sequential objectives + manual dashboard ordering
ALTER TABLE "Project" ADD COLUMN     "sequentialObjectives" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: inventory item ordering
ALTER TABLE "InventoryItem" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill a stable initial sortOrder for existing top-level quests (per user, by age).
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt") AS rn
  FROM "Project"
  WHERE "parentId" IS NULL
)
UPDATE "Project" p
SET "sortOrder" = ranked.rn
FROM ranked
WHERE p."id" = ranked."id";

-- Backfill a stable initial order for existing inventory items (per quest).
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "id") AS rn
  FROM "InventoryItem"
)
UPDATE "InventoryItem" i
SET "order" = ranked.rn
FROM ranked
WHERE i."id" = ranked."id";
