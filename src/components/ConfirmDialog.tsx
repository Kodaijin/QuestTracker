'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small in-app confirmation modal. Used in place of `window.confirm`, which is
 * unreliable inside the Capacitor Android WebView. Backdrop click and Escape both
 * cancel. No portal — a `fixed inset-0` overlay is enough for this app.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  // Escape closes the dialog while it's open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />
      {/* Card */}
      <div className="relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl animate-card-enter">
        <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
        {message && <p className="mt-2 text-sm text-zinc-400">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
