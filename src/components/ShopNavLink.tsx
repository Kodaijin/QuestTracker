'use client';

import Link from 'next/link';
import { useCosmetics } from '@/app/providers';

interface Props {
  /** 'text' for the lightweight section-header style, 'pill' for the dashboard nav row. */
  variant?: 'text' | 'pill';
}

const TEXT_CLASS =
  'text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1';
const PILL_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 transition-all';

/** "Shop" nav link showing the live Quest Gems balance (from the cosmetics context). */
export default function ShopNavLink({ variant = 'text' }: Props) {
  const { balance } = useCosmetics();
  return (
    <Link href="/shop" className={variant === 'pill' ? PILL_CLASS : TEXT_CLASS}>
      <span aria-hidden>💎</span>
      <span className="tabular-nums">{balance}</span>
    </Link>
  );
}
