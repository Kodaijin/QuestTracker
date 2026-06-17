'use client';

import Link from 'next/link';
import type { AchievementStatus } from '@/app/actions/achievements';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import LogoutButton from '@/components/LogoutButton';
import PartyNavLink from '@/components/PartyNavLink';
import NotificationBell from '@/components/NotificationBell';
import { cn } from '@/lib/utils';

interface Props {
  achievements: AchievementStatus[];
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AchievementsClient({ achievements }: Props) {
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const total = achievements.length;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <PartyNavLink />
          <LogoutButton />
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
          🏆 Achievements
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cheeky badges earned just by using QuestLog.
        </p>
        <div className="mt-5 space-y-1.5 max-w-md">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              {unlocked}/{total} unlocked
            </span>
            <span className="font-medium text-zinc-300">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map((a, i) => (
          <div
            key={a.key}
            className="animate-card-enter"
            style={{ animationDelay: `${Math.min(i, 16) * 35}ms` }}
          >
          <Card
            className={cn(
              'h-full transition-colors',
              a.unlocked
                ? 'border-amber-500/40 bg-amber-950/10'
                : 'border-zinc-800/80 opacity-60',
            )}
          >
            <CardContent className="pt-6 flex items-start gap-3">
              <span
                className={cn(
                  'text-3xl leading-none flex-shrink-0',
                  !a.unlocked && 'grayscale opacity-50',
                )}
                aria-hidden
              >
                {a.unlocked ? a.icon : '🔒'}
              </span>
              <div className="min-w-0">
                <h2
                  className={cn(
                    'font-semibold leading-tight',
                    a.unlocked ? 'text-amber-200' : 'text-zinc-400',
                  )}
                >
                  {a.name}
                </h2>
                <p className="mt-0.5 text-sm text-zinc-400 leading-snug">
                  {a.description}
                </p>
                {a.unlocked && a.unlockedAt && (
                  <p className="mt-1.5 text-xs text-amber-500/70">
                    Unlocked {formatDate(a.unlockedAt)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        ))}
      </div>
    </main>
  );
}
