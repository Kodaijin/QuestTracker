'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUnreadNotificationCount } from '@/app/actions/notifications';

interface Props {
  /** 'text' for the lightweight section-header style, 'pill' for the dashboard nav row. */
  variant?: 'text' | 'pill';
  initialCount?: number;
}

const TEXT_CLASS =
  'relative text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1';
const PILL_CLASS =
  'relative inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all';

/**
 * "Alerts" nav link with an unread-notification badge. Self-fetches its count so
 * it can drop onto any page header — mirrors PartyNavLink.
 */
export default function NotificationBell({ variant = 'text', initialCount = 0 }: Props) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;
    getUnreadNotificationCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        /* unauthenticated or transient — leave the count as-is */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link href="/notifications" className={variant === 'pill' ? PILL_CLASS : TEXT_CLASS}>
      <span aria-hidden>🔔</span> Alerts
      {count > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-indigo-500 text-white text-xs font-semibold h-5 min-w-5 px-1.5">
          {count}
        </span>
      )}
    </Link>
  );
}
