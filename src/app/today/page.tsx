import { redirect } from 'next/navigation';
import { getMyResetHour, getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import TodayClient from '@/components/TodayClient';

export default async function TodayPage() {
  const projects = await syncRecurringQuests()
    .then(() => getProjectsForUser())
    .catch(() => redirect('/login'));
  const resetHour = await getMyResetHour();
  return <TodayClient initialProjects={projects} resetHour={resetHour} />;
}
