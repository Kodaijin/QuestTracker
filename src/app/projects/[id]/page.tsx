import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import { listConnections } from '@/app/actions/party';
import ProjectWorkspace from '@/components/ProjectWorkspace';

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  // Advance any elapsed recurring quests before loading data.
  // If the user is unauthenticated, syncRecurringQuests throws 'Unauthorized'
  // which is caught by the same .catch(() => redirect('/login')) below.
  const projects = await syncRecurringQuests()
    .then(() => getProjectsForUser())
    .catch(() => redirect('/login'));

  if (!projects.find((p) => p.id === params.id)) notFound();

  const session = await getServerSession(authOptions);
  const allies = await listConnections();

  return (
    <ProjectWorkspace
      initialProjects={projects}
      projectId={params.id}
      currentUserId={session!.user.id}
      allies={allies}
    />
  );
}
