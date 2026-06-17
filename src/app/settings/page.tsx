import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SettingsClient from '@/components/SettingsClient';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, username: true },
  });

  // Fallback should never be reached since the session guarantees the user exists,
  // but redirect defensively to avoid passing null into the client.
  if (!user) {
    redirect('/login');
  }

  return <SettingsClient currentEmail={user.email} currentUsername={user.username} />;
}
