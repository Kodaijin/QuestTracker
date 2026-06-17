'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { registerUser } from '@/app/actions/auth';

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const email = data.get('email') as string;
    const password = data.get('password') as string;
    const username = (data.get('username') as string).trim();
    const nameRaw = (data.get('name') as string).trim();
    const name = nameRaw || undefined;
    const securityQuestion = data.get('securityQuestion') as string;
    const securityAnswer = data.get('securityAnswer') as string;

    const result = await registerUser({ email, password, username, name, securityQuestion, securityAnswer });

    if (!result.ok) {
      setError(result.error);
      setIsPending(false);
      return;
    }

    await signIn('credentials', {
      email,
      password,
      redirect: true,
      callbackUrl: '/',
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-2xl shadow-black/40 backdrop-blur-sm p-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mb-1">
          Create your account
        </h1>
        <p className="text-sm text-zinc-400 mb-6">Start tracking your quests.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Name <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              placeholder="dragonslayer"
              className="field"
            />
            <p className="mt-1 text-xs text-zinc-500">3–20 letters, numbers, or underscores. Others use this to invite you to party quests.</p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Password{' '}
              <span className="text-zinc-500 font-normal">(min 8 characters)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="securityQuestion" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Security question / hint
            </label>
            <input
              id="securityQuestion"
              name="securityQuestion"
              type="text"
              required
              maxLength={200}
              placeholder="Name of my first pet?"
              className="field"
            />
            <p className="mt-1 text-xs text-zinc-500">Used to recover your account if you forget your password.</p>
          </div>

          <div>
            <label htmlFor="securityAnswer" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Recovery answer
            </label>
            <input
              id="securityAnswer"
              name="securityAnswer"
              type="text"
              required
              autoComplete="off"
              className="field"
            />
            <p className="mt-1 text-xs text-zinc-500">Case-insensitive. You&apos;ll need this to reset your password.</p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-300 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-all"
          >
            {isPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
