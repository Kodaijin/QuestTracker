-- AlterTable
ALTER TABLE "User" ADD COLUMN     "themeId" TEXT,
ADD COLUMN     "xpBarId" TEXT,
ADD COLUMN     "frameId" TEXT,
ADD COLUMN     "particleId" TEXT;

-- CreateTable
CREATE TABLE "CosmeticUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CosmeticUnlock_userId_idx" ON "CosmeticUnlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticUnlock_userId_cosmeticId_key" ON "CosmeticUnlock"("userId", "cosmeticId");

-- AddForeignKey
ALTER TABLE "CosmeticUnlock" ADD CONSTRAINT "CosmeticUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
