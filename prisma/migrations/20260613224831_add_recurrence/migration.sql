-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'EVERY_N_WEEKS', 'MONTHLY', 'SPECIFIC_DATE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "dayOfMonth" INTEGER,
ADD COLUMN     "dayOfWeek" INTEGER,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "intervalWeeks" INTEGER,
ADD COLUMN     "lastCompletedAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "specificDate" TIMESTAMP(3);
