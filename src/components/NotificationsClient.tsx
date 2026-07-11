'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Notification } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import LogoutButton from '@/components/LogoutButton';
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/app/actions/notifications';
import { cn } from '@/lib/utils';

interface Props {
  initialNotifications: Notification[];
}

const TYPE_ICON: Record<string, string> = {
  inactivity: '👋',
  streak: '🔥',
  deadline: '⏳',
  pet: '🐉',
  gift: '🎁',
};

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsClient({ initialNotifications }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const hasUnread = initialNotifications.some((n) => n.readAt == null);

  function handleOpen(n: Notification) {
    startTransition(async () => {
      if (n.readAt == null) await markNotificationRead({ id: n.id });
      if (n.href) router.push(n.href);
      else router.refresh();
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>
        <LogoutButton />
      </div>

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">🔔 Alerts</h1>
          <p className="mt-1 text-sm text-zinc-400">Reminders and nudges from your quest log.</p>
        </div>
        {hasUnread && (
          <Button variant="ghost" size="sm" onClick={handleMarkAll} disabled={isPending}>
            Mark all read
          </Button>
        )}
      </div>

      {initialNotifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-16 text-center text-zinc-500">
          No alerts yet — reminders will show up here.
        </div>
      ) : (
        <ul className="space-y-2">
          {initialNotifications.map((n) => {
            const unread = n.readAt == null;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(n)}
                  disabled={isPending}
                  className={cn(
                    'w-full text-left flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                    unread
                      ? 'border-indigo-500/40 bg-indigo-950/20 hover:bg-indigo-950/30'
                      : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70',
                  )}
                >
                  <span className="text-xl leading-none flex-shrink-0" aria-hidden>
                    {TYPE_ICON[n.type] ?? '🔔'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn('font-medium truncate', unread ? 'text-zinc-100' : 'text-zinc-300')}>
                        {n.title}
                      </span>
                      {unread && <span className="h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" aria-label="unread" />}
                    </span>
                    <span className="block text-sm text-zinc-400 leading-snug">{n.body}</span>
                    <span className="block text-xs text-zinc-600 mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
