import { redirect } from 'next/navigation';
import { getProgression } from '@/app/actions/progression';
import { getAchievements } from '@/app/actions/achievements';
import { getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import { computeStats } from '@/lib/achievements';
import HeroClient from '@/components/HeroClient';

export default async function HeroPage() {
  const data = await syncRecurringQuests()
    .then(async () => {
      const [progression, achievements, projects] = await Promise.all([
        getProgression(),
        getAchievements(),
        getProjectsForUser(),
      ]);
      return { progression, achievements, stats: computeStats(projects) };
    })
    .catch(() => redirect('/login'));

  return (
    <HeroClient
      progression={data.progression}
      achievements={data.achievements}
      stats={data.stats}
    />
  );
}
