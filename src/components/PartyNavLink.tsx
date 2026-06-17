'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPendingNoticeCount } from '@/app/actions/party';

interface Props {
  /** Server-fetched count for instant first paint (optional). */
  initialCount?: number;
}

/**
 * Compact "Party" nav link with a pending-notice badge (incoming ally requests +
 * quest invites). Self-fetches its count so it can be dropped on any page header
 * without threading props — mirrors ProgressionHeader's self-contained pattern.
 */
export default function PartyNavLink({ initialCount = 0 }: Props) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;
    getPendingNoticeCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        /* unauthenticated or transient — leave the current count as-is */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/party"
      className="relative text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
    >
      <span aria-hidden>🧑‍🤝‍🧑</span> Party
      {count > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-indigo-500 text-white text-xs font-semibold h-5 min-w-5 px-1.5">
          {count}
        </span>
      )}
    </Link>
  );
}
