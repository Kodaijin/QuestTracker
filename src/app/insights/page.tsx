import { redirect } from 'next/navigation';
import { getInsights } from '@/app/actions/progression';
import InsightsClient from '@/components/InsightsClient';

export default async function InsightsPage() {
  const insights = await getInsights().catch(() => redirect('/login'));
  return <InsightsClient insights={insights} />;
}
