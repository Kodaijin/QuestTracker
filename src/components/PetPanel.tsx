'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { adoptPet, type PetStatus } from '@/app/actions/pet';
import { PET_SPECIES, MOOD_META, type PetSpeciesId } from '@/lib/pet';
import { cn } from '@/lib/utils';

interface Props {
  petStatus: PetStatus | null;
}

export default function PetPanel({ petStatus }: Props) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpeciesId>(PET_SPECIES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdopt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your companion a name');
      return;
    }
    startTransition(async () => {
      const result = await adoptPet({ name: trimmed, species });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  // ── Adopt flow (no pet yet) ─────────────────────────────────────────────────
  if (!petStatus) {
    return (
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-zinc-900/40 mb-8">
        <CardContent className="pt-6">
          <h2 className="text-lg font-bold text-zinc-50">Adopt a companion</h2>
          <p className="mt-0.5 text-sm text-zinc-400">
            Choose a companion to join your journey. It grows as you level up and reacts to your streak.
          </p>
          <form onSubmit={handleAdopt} className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {PET_SPECIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpecies(s.id)}
                  aria-pressed={species === s.id}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    species === s.id
                      ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  <span className="text-xl leading-none" aria-hidden>{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="pet-name" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Name
              </label>
              <input
                id="pet-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="field"
                placeholder="Ember"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Hatching…' : '🥚 Adopt companion'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // ── Display (has pet) ───────────────────────────────────────────────────────
  const { name: petName, stage, mood, level } = petStatus;
  const m = MOOD_META[mood];

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-zinc-900/40 mb-8">
      <CardContent className="pt-6">
        <div className="flex items-center gap-5">
          {/* Companion art */}
          <div className="relative flex items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-950/30 w-24 h-24 flex-shrink-0">
            <span className="text-5xl leading-none" aria-hidden>{stage.emoji}</span>
            {stage.aura && (
              <span className="absolute -top-1 -right-1 text-xl" aria-hidden>{stage.aura}</span>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-zinc-50 truncate">{petName}</h2>
              <span className="inline-flex items-center rounded-md bg-emerald-950/40 border border-emerald-500/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                {stage.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">
              <span aria-hidden>{m.icon}</span> {m.blurb(petName)}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {stage.nextLevel != null
                ? `Evolves at level ${stage.nextLevel} — you're level ${level}.`
                : `Fully evolved at level ${level}. Legendary!`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
