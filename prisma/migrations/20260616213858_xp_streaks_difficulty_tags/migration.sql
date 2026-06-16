-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('TRIVIAL', 'EASY', 'NORMAL', 'HARD', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "CompletionType" AS ENUM ('OBJECTIVE', 'QUEST', 'ITEM');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CompletionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CompletionType" NOT NULL,
    "projectId" TEXT,
    "xp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompletionEvent_userId_createdAt_idx" ON "CompletionEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompletionEvent" ADD CONSTRAINT "CompletionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
