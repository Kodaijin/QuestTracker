'use client';

import Link from 'next/link';
import type { Progression } from '@/app/actions/progression';
import type { AchievementStatus } from '@/app/actions/achievements';
import type { PetStatus } from '@/app/actions/pet';
import type { QuestStats } from '@/lib/achievements';
import { Card, CardContent } from '@/components/ui/card';
import LogoutButton from '@/components/LogoutButton';
import PartyNavLink from '@/components/PartyNavLink';
import NotificationBell from '@/components/NotificationBell';
import PetPanel from '@/components/PetPanel';
import CountUp from '@/components/CountUp';
import { cn } from '@/lib/utils';

interface Props {
  progression: Progression;
  achievements: AchievementStatus[];
  stats: QuestStats;
  petStatus: PetStatus | null;
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 flex flex-col items-center gap-0.5">
      <CountUp value={value} className={cn('text-2xl font-bold tabular-nums text-zinc-100', accent)} />
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide text-center">
        {label}
      </span>
    </div>
  );
}

export default function HeroClient({ progression, achievements, stats, petStatus }: Props) {
  const xpPct =
    progression.xpForNextLevel > 0
      ? Math.min(100, Math.round((progression.xpIntoLevel / progression.xpForNextLevel) * 100))
      : 100;

  const unlocked = achievements.filter((a) => a.unlocked);
  const recent = [...unlocked]
    .filter((a) => a.unlockedAt != null)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
    .slice(0, 8);

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

      {/* Hero banner: level + XP + streak */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-zinc-900/40 mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Level medallion */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/50 bg-amber-950/40 px-6 py-4 min-w-[7rem]">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-400/80">
                Level
              </span>
              <CountUp value={progression.level} className="text-5xl font-bold leading-none text-amber-200" />
            </div>

            {/* Title + XP bar */}
            <div className="flex-1 w-full min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                {progression.title}
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                {progression.totalXp.toLocaleString()} total XP earned
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>
                    {progression.xpIntoLevel} / {progression.xpForNextLevel} XP to level {progression.level + 1}
                  </span>
                  <span className="font-medium text-amber-300">{xpPct}%</span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-[width] duration-700 ease-out"
                    style={{ width: `${xpPct}%` }}
                  >
                    {xpPct > 0 && (
                      <span
                        className="progress-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Streak */}
            <div className="flex gap-4 sm:flex-col sm:gap-2">
              <div className="flex flex-col items-center">
                <span className="text-2xl" aria-hidden>🔥</span>
                <CountUp value={progression.streak.current} className="text-xl font-bold text-orange-300" />
                <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Current</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl opacity-70" aria-hidden>🏅</span>
                <CountUp value={progression.streak.longest} className="text-xl font-bold text-amber-300" />
                <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Best</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companion */}
      <PetPanel petStatus={petStatus} />

      {/* Lifetime stats */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">
        Lifetime stats
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        <StatTile label="Quests Completed" value={stats.completedQuests} accent="text-emerald-300" />
        <StatTile label="Objectives Checked" value={stats.completedObjectives} />
        <StatTile label="Items Gathered" value={stats.gatheredItems} />
        <StatTile label="Epics Completed" value={stats.epicsCompleted} accent="text-amber-300" />
        <StatTile label="Total Quests" value={stats.totalQuests} />
        <StatTile label="In Progress" value={stats.inProgressQuests} accent="text-indigo-300" />
        <StatTile label="Recurring Quests" value={stats.recurringQuests} />
        <StatTile label="Achievements" value={unlocked.length} accent="text-amber-300" />
      </div>

      {/* Recent achievements */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Recent achievements
        </h2>
        <Link href="/achievements" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          View all ({unlocked.length}/{achievements.length}) →
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No achievements yet — complete a quest to earn your first badge.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recent.map((a) => (
            <Card key={a.key} className="border-amber-500/40 bg-amber-950/10">
              <CardContent className="pt-4 pb-4 flex items-start gap-3">
                <span className="text-2xl leading-none flex-shrink-0" aria-hidden>
                  {a.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-tight text-amber-200">{a.name}</h3>
                  <p className="mt-0.5 text-sm text-zinc-400 leading-snug">{a.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
