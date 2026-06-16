-- AlterTable: replace InventoryItem.quantity with a gathered checkbox
ALTER TABLE "InventoryItem" DROP COLUMN "quantity",
ADD COLUMN     "gathered" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UnlockedAchievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UnlockedAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnlockedAchievement_userId_idx" ON "UnlockedAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockedAchievement_userId_key_key" ON "UnlockedAchievement"("userId", "key");

-- AddForeignKey
ALTER TABLE "UnlockedAchievement" ADD CONSTRAINT "UnlockedAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
