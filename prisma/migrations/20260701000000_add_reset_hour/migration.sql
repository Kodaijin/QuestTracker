-- AlterTable: per-quest daily reset hour override (null = follow user default)
ALTER TABLE "Project" ADD COLUMN     "resetHour" INTEGER;

-- AlterTable: user's global daily reset hour (default 4 AM)
ALTER TABLE "NotificationPreference" ADD COLUMN     "resetHour" INTEGER NOT NULL DEFAULT 4;
