-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "epicOrder" INTEGER,
ADD COLUMN     "isEpic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "sequential" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Project_parentId_idx" ON "Project"("parentId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
