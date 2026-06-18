'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  purchaseCosmetic,
  equipCosmetic,
  type CosmeticsState,
} from '@/app/actions/cosmetics';
import { useCosmetics } from '@/app/providers';
import {
  COSMETIC_CATEGORIES,
  cosmeticsByCategory,
  type Cosmetic,
  type CosmeticCategory,
} from '@/lib/cosmetics';
import { cn } from '@/lib/utils';

interface Props {
  initialState: CosmeticsState;
}

/** A small live preview of what the cosmetic looks like. */
function Preview({ c }: { c: Cosmetic }) {
  const swatch = { background: `linear-gradient(120deg, ${c.swatch[0]}, ${c.swatch[1]})` };

  if (c.category === 'xpbar') {
    return (
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={cn('relative h-full w-2/3 overflow-hidden rounded-full xp-bar-fill', c.className)}>
          <span className="progress-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>
      </div>
    );
  }
  if (c.category === 'frame') {
    return <div className={cn('h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-900/60', c.className)} />;
  }
  if (c.category === 'particle') {
    return (
      <div className={cn('flex h-10 items-center justify-center gap-2 text-xl', c.particle?.colorClass)}>
        {(c.particle?.chars ?? []).map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
      </div>
    );
  }
  // theme
  return <div className="h-10 w-full rounded-lg" style={swatch} aria-hidden />;
}

export default function ShopClient({ initialState }: Props) {
  const { refresh } = useCosmetics();
  const [state, setState] = useState<CosmeticsState>(initialState);
  const [tab, setTab] = useState<CosmeticCategory>('theme');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function applyResult(result: Awaited<ReturnType<typeof purchaseCosmetic>>) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setState(result.state);
    void refresh(); // update the nav gem chip + live theme app-wide
  }

  function handleBuy(c: Cosmetic) {
    setError(null);
    setBusyId(c.id);
    startTransition(async () => {
      applyResult(await purchaseCosmetic({ cosmeticId: c.id }));
      setBusyId(null);
    });
  }

  function handleEquip(c: Cosmetic, equip: boolean) {
    setError(null);
    setBusyId(c.id);
    startTransition(async () => {
      applyResult(await equipCosmetic({ category: c.category, cosmeticId: equip ? c.id : null }));
      setBusyId(null);
    });
  }

  const items = cosmeticsByCategory(tab);

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>
        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-1.5">
          <span aria-hidden>💎</span>
          <span className="font-bold tabular-nums text-amber-200">{state.balance}</span>
          <span className="text-xs text-amber-400/80">gems</span>
        </div>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-50">💎 Shop</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Spend Quest Gems on cosmetics. You&apos;ve earned <span className="text-zinc-200">{state.earned}</span> gems
        and spent <span className="text-zinc-200">{state.spent}</span>. Earn more by leveling up, unlocking
        achievements, and hitting streak milestones.
      </p>

      {/* Category tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {COSMETIC_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setTab(cat.id)}
            aria-pressed={tab === cat.id}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
              tab === cat.id
                ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-200'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Items */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((c) => {
          const owned = state.ownedIds.includes(c.id);
          const equipped = state.equipped[c.category] === c.id;
          const affordable = state.balance >= c.price;
          const busy = busyId === c.id;
          return (
            <Card key={c.id} className={cn(equipped && 'border-emerald-500/50')}>
              <CardContent className="pt-5 space-y-3">
                <Preview c={c} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-zinc-100">{c.name}</h3>
                    <p className="text-xs text-zinc-500">{c.description}</p>
                  </div>
                  {!owned && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-amber-200">
                      💎 {c.price}
                    </span>
                  )}
                </div>

                {owned ? (
                  equipped ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEquip(c, false)}
                      disabled={busy}
                    >
                      Equipped ✓ — Unequip
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleEquip(c, true)} disabled={busy}>
                      Equip
                    </Button>
                  )
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleBuy(c)}
                    disabled={busy || !affordable}
                    title={affordable ? undefined : 'Not enough gems'}
                  >
                    {busy ? 'Buying…' : affordable ? 'Buy' : 'Not enough gems'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
