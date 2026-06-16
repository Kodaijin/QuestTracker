import { redirect } from 'next/navigation';
import { getAchievements } from '@/app/actions/achievements';
import AchievementsClient from '@/components/AchievementsClient';

export default async function AchievementsPage() {
  const achievements = await getAchievements().catch(() => redirect('/login'));
  return <AchievementsClient achievements={achievements} />;
}
