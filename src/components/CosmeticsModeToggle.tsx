'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { setCosmeticsFree } from '@/app/actions/cosmetics';
import { useCosmetics } from '@/app/providers';

/**
 * Settings toggle that opts out of the Quest Gems economy: when on, every
 * cosmetic is unlocked and equippable for free. Reads/writes the shared
 * cosmetics state (via `useCosmetics`) so the Shop and pickers update app-wide.
 */
export default function CosmeticsModeToggle() {
  const router = useRouter();
  const { free, refresh } = useCosmetics();
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      const result = await setCosmeticsFree(next);
      if (result.ok) {
        await refresh();
        // The active background is rendered from the server layout; refresh so a
        // newly-unlocked background can take effect immediately.
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cosmetics</CardTitle>
        <p className="text-sm text-zinc-400">
          Prefer not to bother with Quest Gems? Unlock every cosmetic for free.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span>
            <span className="block text-sm font-medium text-zinc-200">Free cosmetics</span>
            <span className="block text-xs text-zinc-500">
              Equip any theme, XP bar, frame, particle, or background without spending gems.
            </span>
          </span>
          <input
            type="checkbox"
            checked={free}
            disabled={pending}
            onChange={(e) => toggle(e.target.checked)}
            className="h-4 w-4 accent-indigo-500 flex-shrink-0"
          />
        </label>
      </CardContent>
    </Card>
  );
}
