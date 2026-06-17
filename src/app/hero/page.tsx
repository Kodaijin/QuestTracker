import { redirect } from 'next/navigation';
import { getProgression } from '@/app/actions/progression';
import { getAchievements } from '@/app/actions/achievements';
import { getProjectsForUser, syncRecurringQuests } from '@/app/actions/projects';
import { getPetStatus } from '@/app/actions/pet';
import { computeStats } from '@/lib/achievements';
import HeroClient from '@/components/HeroClient';

export default async function HeroPage() {
  const data = await syncRecurringQuests()
    .then(async () => {
      const [progression, achievements, projects, petStatus] = await Promise.all([
        getProgression(),
        getAchievements(),
        getProjectsForUser(),
        getPetStatus(),
      ]);
      return { progression, achievements, stats: computeStats(projects), petStatus };
    })
    .catch(() => redirect('/login'));

  return (
    <HeroClient
      progression={data.progression}
      achievements={data.achievements}
      stats={data.stats}
      petStatus={data.petStatus}
    />
  );
}
