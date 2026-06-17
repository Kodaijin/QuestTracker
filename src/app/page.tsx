import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import { getPendingNoticeCount, listConnections } from '@/app/actions/party';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage() {
  // Advance any elapsed recurring quests before loading data.
  // If the user is unauthenticated, syncRecurringQuests throws 'Unauthorized'
  // which is caught by the same .catch(() => redirect('/login')) below.
  const projects = await syncRecurringQuests()
    .then(() => getProjectsForUser())
    .catch(() => redirect('/login'));

  const session = await getServerSession(authOptions);
  const [pendingNoticeCount, allies] = await Promise.all([
    getPendingNoticeCount(),
    listConnections(),
  ]);

  return (
    <DashboardClient
      initialProjects={projects}
      currentUserId={session!.user.id}
      pendingNoticeCount={pendingNoticeCount}
      allies={allies}
    />
  );
}
