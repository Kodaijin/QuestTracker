import { redirect } from 'next/navigation';
import { getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import CalendarClient from '@/components/CalendarClient';

export default async function CalendarPage() {
  const projects = await syncRecurringQuests()
    .then(() => getProjectsForUser())
    .catch(() => redirect('/login'));
  return <CalendarClient initialProjects={projects} />;
}
