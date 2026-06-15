'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSecurityQuestion, resetPasswordWithAnswer } from '@/app/actions/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleStep1(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const result = await getSecurityQuestion(email);

    if (!result.ok) {
      setError(result.error);
      setIsPending(false);
      return;
    }

    setQuestion(result.question);
    setIsPending(false);
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const result = await resetPasswordWithAnswer({ email, answer, newPassword });

    if (!result.ok) {
      setError(result.error);
      setIsPending(false);
      return;
    }

    setIsPending(false);
    setSucceeded(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-2xl shadow-black/40 backdrop-blur-sm p-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mb-1">
          Reset your password
        </h1>

        {succeeded ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-400">
              Password reset. You can now sign in.
            </p>
            <Link
              href="/login"
              className="inline-block w-full text-center rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 text-white text-sm font-medium py-2.5 transition-all"
            >
              Sign in
            </Link>
          </div>
        ) : step === 1 ? (
          <>
            <p className="text-sm text-zinc-400 mb-6">
              Enter your email to look up your security question.
            </p>
            <form onSubmit={handleStep1} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                />
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
                {isPending ? 'Looking up…' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-400 mb-6">
              Answer your security question to set a new password.
            </p>
            <form onSubmit={handleStep2} className="space-y-4" noValidate>
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-0.5">Account</p>
                <p className="text-sm text-zinc-300">{email}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-0.5">Security question</p>
                <p className="text-sm text-zinc-200 font-medium">{question}</p>
              </div>

              <div>
                <label htmlFor="answer" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Answer
                </label>
                <input
                  id="answer"
                  type="text"
                  required
                  autoComplete="off"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  New password{' '}
                  <span className="text-zinc-500 font-normal">(min 8 characters)</span>
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="field"
                />
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
                {isPending ? 'Resetting…' : 'Reset password'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError(null); setAnswer(''); setNewPassword(''); }}
                className="w-full text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                ← Back
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-zinc-400">
          Remembered it?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
