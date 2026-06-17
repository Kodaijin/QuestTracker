'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  sendConnectionRequest,
  respondToConnection,
  respondToQuestInvite,
  type Ally,
  type IncomingRequest,
  type QuestInvite,
} from '@/app/actions/party';

interface Props {
  initialRequests: IncomingRequest[];
  initialInvites: QuestInvite[];
  initialAllies: Ally[];
}

/** "@username (Display Name)" — falls back gracefully when one is missing. */
function heroLabel(username: string | null, name: string | null): string {
  if (username && name) return `@${username} · ${name}`;
  if (username) return `@${username}`;
  return name ?? 'Unknown hero';
}

export default function PartyClient({
  initialRequests,
  initialInvites,
  initialAllies,
}: Props) {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAddAlly(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await sendConnectionRequest({ username: username.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsername('');
      setSuccess('Request sent! They can accept it from their Party page.');
      router.refresh();
    });
  }

  function handleRespondConnection(connectionId: string, accept: boolean) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await respondToConnection({ connectionId, accept });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleRespondInvite(projectId: string, accept: boolean) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await respondToQuestInvite({ projectId, accept });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-8 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
            clipRule="evenodd"
          />
        </svg>
        Dashboard
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-50 mb-1">🧑‍🤝‍🧑 Party</h1>
      <p className="text-sm text-zinc-400 mb-8">
        Add allies by username, then share quests with them when you create a quest.
      </p>

      <div className="space-y-6">
        {/* ── Add ally ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Add an ally</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleAddAlly} className="space-y-4" noValidate>
              <div>
                <label htmlFor="ally-username" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Their username
                </label>
                <div className="flex gap-2">
                  <input
                    id="ally-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="dragonslayer"
                    className="field flex-1"
                  />
                  <Button type="submit" disabled={isPending || username.trim() === ''}>
                    {isPending ? 'Sending…' : 'Send request'}
                  </Button>
                </div>
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-300 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="text-sm text-emerald-300 bg-emerald-950/50 border border-emerald-900/60 rounded-lg px-3 py-2">
                  {success}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* ── Incoming ally requests ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              Ally requests
              {initialRequests.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-500 text-white text-xs font-semibold h-5 min-w-5 px-1.5">
                  {initialRequests.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {initialRequests.length === 0 ? (
              <p className="text-sm text-zinc-500">No pending requests.</p>
            ) : (
              <ul className="space-y-2">
                {initialRequests.map((r) => (
                  <li
                    key={r.connectionId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5"
                  >
                    <span className="text-sm text-zinc-200">{heroLabel(r.username, r.name)}</span>
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleRespondConnection(r.connectionId, true)}
                        disabled={isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRespondConnection(r.connectionId, false)}
                        disabled={isPending}
                      >
                        Decline
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Quest invites ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              Quest invites
              {initialInvites.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-xs font-semibold h-5 min-w-5 px-1.5">
                  {initialInvites.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {initialInvites.length === 0 ? (
              <p className="text-sm text-zinc-500">No quest invites.</p>
            ) : (
              <ul className="space-y-2">
                {initialInvites.map((inv) => (
                  <li
                    key={inv.projectId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {inv.icon && (
                        <img src={inv.icon} alt="" loading="lazy" className="h-7 w-7 object-contain flex-shrink-0" />
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-100 truncate">{inv.title}</span>
                        <span className="block text-xs text-zinc-500 truncate">
                          from {heroLabel(inv.inviterUsername, inv.inviterName)}
                        </span>
                      </span>
                    </span>
                    <span className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleRespondInvite(inv.projectId, true)}
                        disabled={isPending}
                      >
                        Join
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRespondInvite(inv.projectId, false)}
                        disabled={isPending}
                      >
                        Decline
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Allies ───────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Your allies · {initialAllies.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {initialAllies.length === 0 ? (
              <p className="text-sm text-zinc-500">No allies yet — send a request above to get started.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {initialAllies.map((a) => (
                  <li
                    key={a.connectionId}
                    className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-200"
                  >
                    {heroLabel(a.username, a.name)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
