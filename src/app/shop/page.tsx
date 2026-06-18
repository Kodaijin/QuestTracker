import { redirect } from 'next/navigation';
import { getCosmeticsState } from '@/app/actions/cosmetics';
import ShopClient from '@/components/ShopClient';

export default async function ShopPage() {
  const state = await getCosmeticsState().catch(() => redirect('/login'));
  return <ShopClient initialState={state} />;
}
