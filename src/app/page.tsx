import { redirect } from 'next/navigation';
import { getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage() {
  // Advance any elapsed recurring quests before loading data.
  // If the user is unauthenticated, syncRecurringQuests throws 'Unauthorized'
  // which is caught by the same .catch(() => redirect('/login')) below.
  const projects = await syncRecurringQuests()
    .then(() => getProjectsForUser())
    .catch(() => redirect('/login'));
  return <DashboardClient initialProjects={projects} />;
}
