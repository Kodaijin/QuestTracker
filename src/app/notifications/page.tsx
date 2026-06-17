import { redirect } from 'next/navigation';
import { listNotifications } from '@/app/actions/notifications';
import NotificationsClient from '@/components/NotificationsClient';

export default async function NotificationsPage() {
  const notifications = await listNotifications().catch(() => redirect('/login'));
  return <NotificationsClient initialNotifications={notifications} />;
}
