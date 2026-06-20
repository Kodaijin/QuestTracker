import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getNotificationPreferences } from '@/app/actions/notifications';
import SettingsClient from '@/components/SettingsClient';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, username: true, discordUsername: true },
  });

  // Fallback should never be reached since the session guarantees the user exists,
  // but redirect defensively to avoid passing null into the client.
  if (!user) {
    redirect('/login');
  }

  const notificationPrefs = await getNotificationPreferences();

  return (
    <SettingsClient
      currentEmail={user.email}
      currentUsername={user.username}
      currentDiscordUsername={user.discordUsername}
      notificationPrefs={notificationPrefs}
    />
  );
}
