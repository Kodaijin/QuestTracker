import { redirect } from 'next/navigation';
import { getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import TodayClient from '@/components/TodayClient';

export default async function TodayPage() {
  const projects = await syncRecurringQuests()
    .then(() => getProjectsForUser())
    .catch(() => redirect('/login'));
  return <TodayClient initialProjects={projects} />;
}
