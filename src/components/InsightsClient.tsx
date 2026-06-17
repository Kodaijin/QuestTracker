'use client';

import Link from 'next/link';
import { CompletionType } from '@prisma/client';
import type { Insights } from '@/app/actions/progression';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import LogoutButton from '@/components/LogoutButton';
import PartyNavLink from '@/components/PartyNavLink';
import NotificationBell from '@/components/NotificationBell';
import CountUp from '@/components/CountUp';
import { cn } from '@/lib/utils';

interface Props {
  insights: Insights;
}

/** Heatmap colour by event count for the day. */
function heatClass(count: number): string {
  if (count === 0) return 'bg-zinc-800/80';
  if (count <= 2) return 'bg-emerald-900';
  if (count <= 4) return 'bg-emerald-700';
  if (count <= 7) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 flex flex-col items-center gap-0.5">
      <CountUp value={value} className={cn('text-2xl font-bold tabular-nums text-zinc-100', accent)} />
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide text-center">{label}</span>
    </div>
  );
}

export default function InsightsClient({ insights }: Props) {
  const last30 = insights.daily.slice(-30);
  const maxXp = Math.max(1, ...last30.map((d) => d.xp));

  // Chunk the daily series into weeks (columns) for the heatmap.
  const weeks: typeof insights.daily[] = [];
  for (let i = 0; i < insights.daily.length; i += 7) {
    weeks.push(insights.daily.slice(i, i + 7));
  }

  const typeLabels: Record<CompletionType, string> = {
    [CompletionType.OBJECTIVE]: 'Objectives',
    [CompletionType.QUEST]: 'Quests',
    [CompletionType.ITEM]: 'Items',
  };
  const maxType = Math.max(1, ...Object.values(insights.byType));

  const maxDiffTotal = Math.max(1, ...insights.questsByDifficulty.map((d) => d.total));
  const achPct =
    insights.achievementsTotal > 0
      ? Math.round((insights.achievementsUnlocked / insights.achievementsTotal) * 100)
      : 0;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">📊 Insights</h1>
        <p className="mt-1 text-sm text-zinc-400">Your adventuring habits, by the numbers.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Tile label="Total XP" value={insights.totalXp} accent="text-amber-300" />
        <Tile label="Level" value={insights.level} accent="text-amber-300" />
        <Tile label="Current Streak" value={insights.currentStreak} accent="text-orange-300" />
        <Tile label="Longest Streak" value={insights.longestStreak} accent="text-orange-300" />
      </div>

      {/* Contribution heatmap */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <span
                    key={day.day}
                    title={`${day.day}: ${day.count} completion${day.count === 1 ? '' : 's'}`}
                    className={cn('h-3 w-3 rounded-[2px]', heatClass(day.count))}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <span>Less</span>
            <span className="h-3 w-3 rounded-[2px] bg-zinc-800/80" />
            <span className="h-3 w-3 rounded-[2px] bg-emerald-900" />
            <span className="h-3 w-3 rounded-[2px] bg-emerald-700" />
            <span className="h-3 w-3 rounded-[2px] bg-emerald-500" />
            <span className="h-3 w-3 rounded-[2px] bg-emerald-400" />
            <span>More</span>
          </div>
        </CardContent>
      </Card>

      {/* XP over last 30 days */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>XP earned · last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[3px] h-32">
            {last30.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.xp} XP`}
                className="flex-1 rounded-t bg-gradient-to-t from-amber-600 to-yellow-400 min-h-[2px] transition-all hover:brightness-125"
                style={{ height: `${Math.max(2, (d.xp / maxXp) * 100)}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        {/* Completions by type */}
        <Card>
          <CardHeader>
            <CardTitle>Completions by type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(insights.byType) as CompletionType[]).map((t) => (
              <div key={t}>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>{typeLabels[t]}</span>
                  <span className="tabular-nums text-zinc-300">{insights.byType[t]}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${(insights.byType[t] / maxType) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quests by difficulty */}
        <Card>
          <CardHeader>
            <CardTitle>Quests by difficulty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.questsByDifficulty.map((d) => (
              <div key={d.difficulty}>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>
                    <span aria-hidden>{d.emoji}</span> {d.label}
                  </span>
                  <span className="tabular-nums text-zinc-300">
                    {d.completed}/{d.total} done
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{ width: `${(d.total / maxDiffTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Achievement progress */}
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
            <span>
              {insights.achievementsUnlocked}/{insights.achievementsTotal} unlocked
            </span>
            <span className="font-medium text-amber-300">{achPct}%</span>
          </div>
          <Progress value={achPct} />
          <Link href="/achievements" className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300">
            View all achievements →
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
