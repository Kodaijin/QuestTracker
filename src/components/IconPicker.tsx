'use client';

import { useState, useRef, useEffect } from 'react';
import { listIcons, type IconOption } from '@/app/actions/icons';
import { cn } from '@/lib/utils';

export interface IconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
  disabled?: boolean;
}

export default function IconPicker({ value, onChange, disabled = false }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [icons, setIcons] = useState<IconOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleToggle() {
    if (disabled) return;
    if (!open && !loaded) {
      setLoading(true);
      try {
        const result = await listIcons();
        setIcons(result);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
    setOpen((prev) => !prev);
  }

  function handleSelect(path: string) {
    onChange(path);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
  }

  const filtered = search.trim()
    ? icons.filter((ic) =>
        ic.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : icons;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label={value ? 'Change quest icon' : 'Choose quest icon'}
        aria-expanded={open}
        className={cn(
          'flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          value
            ? 'h-10 w-10 border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 p-1'
            : 'h-10 px-3 gap-1.5 border-dashed border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 text-sm',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        {value ? (
          <img
            src={value}
            alt="Selected icon"
            loading="lazy"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
        ) : (
          <>
            <span aria-hidden="true" className="text-base leading-none">⬡</span>
            <span>Choose icon</span>
          </>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Icon picker"
          className="absolute left-0 top-full mt-2 z-50 rounded-xl border border-zinc-800 bg-zinc-900 p-3 shadow-xl w-80"
        >
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons…"
            aria-label="Search icons"
            autoFocus
            className="field w-full mb-2 text-sm"
          />

          {/* None button */}
          <button
            type="button"
            onClick={handleClear}
            className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-left"
          >
            None — remove icon
          </button>

          {/* Content */}
          {loading ? (
            <p className="text-center text-sm text-zinc-400 py-6">Loading icons…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-6">No icons match.</p>
          ) : (
            <div
              className="max-h-72 overflow-y-auto grid grid-cols-5 sm:grid-cols-6 gap-2"
              role="listbox"
              aria-label="Available icons"
            >
              {filtered.map((opt) => (
                <button
                  key={opt.path}
                  type="button"
                  onClick={() => handleSelect(opt.path)}
                  title={opt.name}
                  aria-label={opt.name}
                  aria-selected={opt.path === value}
                  role="option"
                  className={cn(
                    'flex items-center justify-center rounded-lg p-1 border transition-colors hover:border-indigo-500/60 hover:bg-zinc-800',
                    opt.path === value
                      ? 'border-indigo-500 bg-zinc-800 ring-2 ring-indigo-500'
                      : 'border-transparent bg-zinc-800/30'
                  )}
                >
                  <img
                    src={opt.path}
                    alt={opt.name}
                    loading="lazy"
                    width={48}
                    height={48}
                    className="h-12 w-12 object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
