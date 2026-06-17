'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PartyNavLink from '@/components/PartyNavLink';
import NotificationBell from '@/components/NotificationBell';
import {
  changeEmail,
  changeUsername,
  changePassword,
  changeSecurityQuestion,
} from '@/app/actions/account';
import {
  saveNotificationPreferences,
  type NotificationPrefs,
} from '@/app/actions/notifications';
import { subscribeToPush } from '@/lib/pushClient';
import { cn } from '@/lib/utils';

const REMINDER_TYPES: { key: 'inactivity' | 'streak' | 'deadline' | 'pet'; label: string; desc: string }[] = [
  { key: 'inactivity', label: 'Come-back nudges', desc: "Remind me when I've been away for a couple of days" },
  { key: 'streak', label: 'Streak at risk', desc: 'Warn me in the evening if my streak is about to break' },
  { key: 'deadline', label: 'Quest deadlines', desc: 'Alert me when a quest is due soon or becomes active' },
  { key: 'pet', label: 'Companion', desc: "Let my companion remind me when it's lonely" },
];

interface Props {
  currentEmail: string;
  currentUsername: string | null;
  notificationPrefs: NotificationPrefs;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="text-sm text-red-300 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2"
    >
      {message}
    </p>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="text-sm text-emerald-300 bg-emerald-950/50 border border-emerald-900/60 rounded-lg px-3 py-2"
    >
      {message}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsClient({
  currentEmail,
  currentUsername,
  notificationPrefs,
}: Props) {
  const router = useRouter();

  // ── Notifications state ────────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<NotificationPrefs>(notificationPrefs);
  const [pushMessage, setPushMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [prefsSuccess, setPrefsSuccess] = useState<string | null>(null);
  const [pushPending, startPushTransition] = useTransition();
  const [prefsPending, startPrefsTransition] = useTransition();

  function setPref<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setPrefsSuccess(null);
  }

  function handleEnablePush() {
    setPushMessage(null);
    startPushTransition(async () => {
      const result = await subscribeToPush();
      setPushMessage(
        result.ok
          ? { ok: true, text: 'Push enabled on this device.' }
          : { ok: false, text: result.error },
      );
    });
  }

  function handleSavePrefs() {
    setPrefsSuccess(null);
    startPrefsTransition(async () => {
      const result = await saveNotificationPreferences(prefs);
      if (result.ok) setPrefsSuccess('Notification preferences saved.');
    });
  }

  // ── Change email state ───────────────────────────────────────────────────────
  const [displayedEmail, setDisplayedEmail] = useState(currentEmail);
  const [emailNewEmail, setEmailNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailPending, startEmailTransition] = useTransition();

  // ── Change username state ──────────────────────────────────────────────────────
  const [displayedUsername, setDisplayedUsername] = useState(currentUsername);
  const [unNewUsername, setUnNewUsername] = useState('');
  const [unCurrentPassword, setUnCurrentPassword] = useState('');
  const [unError, setUnError] = useState<string | null>(null);
  const [unSuccess, setUnSuccess] = useState<string | null>(null);
  const [unPending, startUnTransition] = useTransition();

  // ── Change password state ────────────────────────────────────────────────────
  const [pwCurrentPassword, setPwCurrentPassword] = useState('');
  const [pwNewPassword, setPwNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwPending, startPwTransition] = useTransition();

  // ── Change security question state ───────────────────────────────────────────
  const [sqCurrentPassword, setSqCurrentPassword] = useState('');
  const [sqQuestion, setSqQuestion] = useState('');
  const [sqAnswer, setSqAnswer] = useState('');
  const [sqError, setSqError] = useState<string | null>(null);
  const [sqSuccess, setSqSuccess] = useState<string | null>(null);
  const [sqPending, startSqTransition] = useTransition();

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    startEmailTransition(async () => {
      const result = await changeEmail({
        currentPassword: emailCurrentPassword,
        newEmail: emailNewEmail,
      });

      if (!result.ok) {
        setEmailError(result.error);
        return;
      }

      setDisplayedEmail(emailNewEmail.toLowerCase());
      setEmailNewEmail('');
      setEmailCurrentPassword('');
      setEmailSuccess('Email updated. Use your new email next time you sign in.');
      router.refresh();
    });
  }

  function handleUsernameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUnError(null);
    setUnSuccess(null);

    startUnTransition(async () => {
      const result = await changeUsername({
        currentPassword: unCurrentPassword,
        newUsername: unNewUsername,
      });

      if (!result.ok) {
        setUnError(result.error);
        return;
      }

      setDisplayedUsername(unNewUsername.toLowerCase());
      setUnNewUsername('');
      setUnCurrentPassword('');
      setUnSuccess('Username updated. Allies can now invite you with it.');
      router.refresh();
    });
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    startPwTransition(async () => {
      const result = await changePassword({
        currentPassword: pwCurrentPassword,
        newPassword: pwNewPassword,
      });

      if (!result.ok) {
        setPwError(result.error);
        return;
      }

      setPwCurrentPassword('');
      setPwNewPassword('');
      setPwSuccess('Password updated.');
    });
  }

  function handleSecurityQuestionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSqError(null);
    setSqSuccess(null);

    startSqTransition(async () => {
      const result = await changeSecurityQuestion({
        currentPassword: sqCurrentPassword,
        securityQuestion: sqQuestion,
        securityAnswer: sqAnswer,
      });

      if (!result.ok) {
        setSqError(result.error);
        return;
      }

      setSqQuestion('');
      setSqAnswer('');
      setSqSuccess('Security question updated.');
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {/* Back link + Party */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <PartyNavLink />
        </div>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-50 mb-8">
        Account settings
      </h1>

      <div className="space-y-6">
        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <p className="text-sm text-zinc-400">
              Reminders to keep your streak, quests, and companion on track.
            </p>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {/* Enable push on this device */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-200">Browser push</p>
                <p className="text-xs text-zinc-500">
                  Enable notifications on this device — they arrive even when the app is closed.
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushPending}
                className="flex-shrink-0 rounded-lg border border-indigo-500/50 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-200 text-sm font-medium px-4 py-2 transition-all disabled:opacity-60"
              >
                {pushPending ? 'Enabling…' : 'Enable push'}
              </button>
            </div>
            {pushMessage &&
              (pushMessage.ok ? (
                <SuccessBox message={pushMessage.text} />
              ) : (
                <ErrorBox message={pushMessage.text} />
              ))}

            <div className="h-px bg-zinc-800" />

            {/* Master switch */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-medium text-zinc-200">Reminders enabled</span>
              <input
                type="checkbox"
                checked={prefs.enabled}
                onChange={(e) => setPref('enabled', e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
            </label>

            {/* Per-type toggles + reminder time */}
            <div className={cn('space-y-3', !prefs.enabled && 'opacity-50 pointer-events-none')}>
              {REMINDER_TYPES.map((t) => (
                <label key={t.key} className="flex items-center justify-between gap-3 cursor-pointer">
                  <span>
                    <span className="block text-sm text-zinc-200">{t.label}</span>
                    <span className="block text-xs text-zinc-500">{t.desc}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[t.key]}
                    onChange={(e) => setPref(t.key, e.target.checked)}
                    className="h-4 w-4 accent-indigo-500 flex-shrink-0"
                  />
                </label>
              ))}

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-200">Daily reminder time</span>
                <select
                  value={prefs.reminderHour}
                  onChange={(e) => setPref('reminderHour', Number(e.target.value))}
                  className="field max-w-[8rem]"
                  aria-label="Daily reminder time"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {prefsSuccess && <SuccessBox message={prefsSuccess} />}

            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={prefsPending}
              className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 transition-all"
            >
              {prefsPending ? 'Saving…' : 'Save preferences'}
            </button>
          </CardContent>
        </Card>

        {/* ── Change email ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Change email</CardTitle>
            <p className="text-sm text-zinc-400">
              Current email:{' '}
              <span className="text-zinc-200 font-medium">{displayedEmail}</span>
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email-new"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  New email
                </label>
                <input
                  id="email-new"
                  type="email"
                  value={emailNewEmail}
                  onChange={(e) => setEmailNewEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="field"
                />
              </div>

              <div>
                <label
                  htmlFor="email-current-pw"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Current password
                </label>
                <input
                  id="email-current-pw"
                  type="password"
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="field"
                />
              </div>

              {emailError && <ErrorBox message={emailError} />}
              {emailSuccess && <SuccessBox message={emailSuccess} />}

              <button
                type="submit"
                disabled={emailPending}
                className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 transition-all"
              >
                {emailPending ? 'Saving…' : 'Update email'}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* ── Change username ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Change username</CardTitle>
            <p className="text-sm text-zinc-400">
              {displayedUsername ? (
                <>
                  Current username:{' '}
                  <span className="text-zinc-200 font-medium">@{displayedUsername}</span>
                </>
              ) : (
                <span className="text-amber-300">
                  You don&apos;t have a username yet — set one so allies can invite you.
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleUsernameSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="username-new"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  New username
                </label>
                <input
                  id="username-new"
                  type="text"
                  value={unNewUsername}
                  onChange={(e) => setUnNewUsername(e.target.value)}
                  autoComplete="username"
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  required
                  className="field"
                />
                <p className="mt-1 text-xs text-zinc-500">3–20 letters, numbers, or underscores.</p>
              </div>

              <div>
                <label
                  htmlFor="username-current-pw"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Current password
                </label>
                <input
                  id="username-current-pw"
                  type="password"
                  value={unCurrentPassword}
                  onChange={(e) => setUnCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="field"
                />
              </div>

              {unError && <ErrorBox message={unError} />}
              {unSuccess && <SuccessBox message={unSuccess} />}

              <button
                type="submit"
                disabled={unPending}
                className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 transition-all"
              >
                {unPending ? 'Saving…' : 'Update username'}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* ── Change password ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="pw-current"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Current password
                </label>
                <input
                  id="pw-current"
                  type="password"
                  value={pwCurrentPassword}
                  onChange={(e) => setPwCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="field"
                />
              </div>

              <div>
                <label
                  htmlFor="pw-new"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  New password
                </label>
                <input
                  id="pw-new"
                  type="password"
                  value={pwNewPassword}
                  onChange={(e) => setPwNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="field"
                />
                <p className="mt-1 text-xs text-zinc-500">Min 8 characters.</p>
              </div>

              {pwError && <ErrorBox message={pwError} />}
              {pwSuccess && <SuccessBox message={pwSuccess} />}

              <button
                type="submit"
                disabled={pwPending}
                className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 transition-all"
              >
                {pwPending ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* ── Change security question ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Change security question</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form
              onSubmit={handleSecurityQuestionSubmit}
              className="space-y-4"
              noValidate
            >
              <div>
                <label
                  htmlFor="sq-current-pw"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Current password
                </label>
                <input
                  id="sq-current-pw"
                  type="password"
                  value={sqCurrentPassword}
                  onChange={(e) => setSqCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="field"
                />
              </div>

              <div>
                <label
                  htmlFor="sq-question"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  New security question / hint
                </label>
                <input
                  id="sq-question"
                  type="text"
                  value={sqQuestion}
                  onChange={(e) => setSqQuestion(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. Name of your first pet?"
                  required
                  className="field"
                />
              </div>

              <div>
                <label
                  htmlFor="sq-answer"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  New recovery answer
                </label>
                <input
                  id="sq-answer"
                  type="text"
                  value={sqAnswer}
                  onChange={(e) => setSqAnswer(e.target.value)}
                  autoComplete="off"
                  required
                  className="field"
                />
                <p className="mt-1 text-xs text-zinc-500">Case-insensitive.</p>
              </div>

              {sqError && <ErrorBox message={sqError} />}
              {sqSuccess && <SuccessBox message={sqSuccess} />}

              <button
                type="submit"
                disabled={sqPending}
                className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 transition-all"
              >
                {sqPending ? 'Saving…' : 'Update security question'}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
