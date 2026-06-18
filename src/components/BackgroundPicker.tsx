'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { equipCosmetic } from '@/app/actions/cosmetics';
import { useCosmetics } from '@/app/providers';
import { cosmeticsByCategory, type Cosmetic } from '@/lib/cosmetics';
import { cn } from '@/lib/utils';

/**
 * Background picker for Settings. Free + owned backgrounds equip inline; premium
 * ones that aren't owned link out to the Shop. Reads/writes the same cosmetics
 * state the Shop uses (via `useCosmetics`), so changes apply app-wide.
 */
export default function BackgroundPicker() {
  const { equipped, ownedIds, refresh } = useCosmetics();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const backgrounds = cosmeticsByCategory('background');
  // No explicit equip falls back to the default Aurora.
  const activeId = equipped.background ?? 'bg-aurora';

  function equip(id: string) {
    setBusyId(id);
    startTransition(async () => {
      await equipCosmetic({ category: 'background', cosmeticId: id });
      await refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background</CardTitle>
        <p className="text-sm text-zinc-400">
          The ambient backdrop behind everything. Animated ones use WebGL and gracefully fall
          back to the classic aurora if your device or reduced-motion setting requires it.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {backgrounds.map((c) => {
            const unlocked = c.free || ownedIds.includes(c.id);
            const active = activeId === c.id;
            const busy = busyId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  'rounded-xl border p-3',
                  active ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-zinc-800 bg-zinc-900/40',
                )}
              >
                <BackgroundSwatch c={c} />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-zinc-100">{c.name}</h3>
                    <p className="text-xs text-zinc-500">{c.description}</p>
                  </div>
                  {!unlocked && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-amber-200">
                      💎 {c.price}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  {unlocked ? (
                    active ? (
                      <Button size="sm" variant="ghost" disabled>
                        Active ✓
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => equip(c.id)} disabled={busy}>
                        {busy ? 'Applying…' : 'Use'}
                      </Button>
                    )
                  ) : (
                    <Link href="/shop" className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }))}>
                      Unlock in Shop
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** A small gradient swatch preview built from the cosmetic's two colors. */
function BackgroundSwatch({ c }: { c: Cosmetic }) {
  return (
    <div
      aria-hidden
      className="h-16 w-full rounded-lg border border-zinc-800/80"
      style={{ background: `linear-gradient(135deg, ${c.swatch[0]}, ${c.swatch[1]})` }}
    />
  );
}
