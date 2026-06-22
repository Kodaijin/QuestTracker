'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { exportQuests, importQuests } from '@/app/actions/data';

export default function DataExportImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportError, setExportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [exporting, startExport] = useTransition();
  const [importing, startImport] = useTransition();

  function handleExport() {
    setExportError(null);
    startExport(async () => {
      try {
        const data = await exportQuests();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `questtracker-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setExportError('Failed to export your quests. Please try again.');
      }
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Allow re-importing the same file twice in a row.
    e.target.value = '';
    if (!file) return;

    setImportMessage(null);
    startImport(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        setImportMessage({ ok: false, text: 'That file is not valid JSON.' });
        return;
      }
      const result = await importQuests(parsed);
      if (result.ok) {
        setImportMessage({
          ok: true,
          text: `Imported ${result.imported} quest${result.imported === 1 ? '' : 's'}.`,
        });
        router.refresh();
      } else {
        setImportMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export &amp; import quests</CardTitle>
        <p className="text-sm text-zinc-400">
          Download all your quests as a JSON file for backup, or import a file to add them to your
          board. Importing adds quests alongside your existing ones — it never overwrites them.
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg border border-indigo-500/50 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-200 text-sm font-medium px-4 py-2 transition-all disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export to JSON'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-200 text-sm font-medium px-4 py-2 transition-all disabled:opacity-60"
          >
            {importing ? 'Importing…' : 'Import from JSON'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {exportError && (
          <p
            role="alert"
            className="text-sm text-red-300 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2"
          >
            {exportError}
          </p>
        )}
        {importMessage && (
          <p
            role={importMessage.ok ? 'status' : 'alert'}
            className={
              importMessage.ok
                ? 'text-sm text-emerald-300 bg-emerald-950/50 border border-emerald-900/60 rounded-lg px-3 py-2'
                : 'text-sm text-red-300 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2'
            }
          >
            {importMessage.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
