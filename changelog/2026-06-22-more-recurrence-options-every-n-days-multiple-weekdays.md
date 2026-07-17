# 2026-06-22: More recurrence options — every N days & multiple weekdays


- Two new repeat schedules: **Every N days** (`EVERY_N_DAYS` + `Project.intervalDays`) and **Days of week** for picking multiple weekdays like Mon/Wed/Fri (`DAYS_OF_WEEK` + `Project.daysOfWeek` int array). Available in the New Quest form and a quest's Schedule editor
- Recurrence math, labels, calendar plotting, validation, and JSON export/import all handle the new kinds (`src/lib/recurrence.ts`, `src/app/actions/projects.ts`, `src/app/actions/data.ts`)
