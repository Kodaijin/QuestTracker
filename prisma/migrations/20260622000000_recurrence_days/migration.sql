-- AlterEnum: new recurrence kinds (every N days, multiple weekdays)
ALTER TYPE "RecurrenceType" ADD VALUE 'EVERY_N_DAYS';
ALTER TYPE "RecurrenceType" ADD VALUE 'DAYS_OF_WEEK';

-- AlterTable: interval-in-days + a set of weekdays
ALTER TABLE "Project" ADD COLUMN     "intervalDays" INTEGER,
ADD COLUMN     "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
