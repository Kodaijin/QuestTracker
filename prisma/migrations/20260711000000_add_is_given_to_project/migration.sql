-- AlterTable: mark a quest that was built and handed to a single ally to do (a
-- "given" quest). Recipient checks off objectives but can't edit; owner keeps
-- edit rights and watches progress. XP is split (recipient full, owner half).
ALTER TABLE "Project" ADD COLUMN     "isGiven" BOOLEAN NOT NULL DEFAULT false;
