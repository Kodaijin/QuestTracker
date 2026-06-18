'use client';

import { useEffect, useState } from 'react';

/**
 * Returns whether rich WebGL surfaces should render. False when the user prefers
 * reduced motion or the browser can't create a WebGL context — in which case
 * callers fall back to the existing CSS/DOM visuals.
 *
 * Always returns false on the server and on first client render, then settles to
 * the real value after mount. This keeps SSR markup identical for everyone (no
 * hydration mismatch) — the WebGL layer fades in only once we know it's safe.
 */
export function useWebGLEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function evaluate() {
      setEnabled(!reduced.matches && hasWebGL());
    }

    evaluate();
    // Re-evaluate if the user toggles the OS reduced-motion setting live.
    reduced.addEventListener('change', evaluate);
    return () => reduced.removeEventListener('change', evaluate);
  }, []);

  return enabled;
}

/**
 * Synchronous check for components that only ever mount client-side after a user
 * action (e.g. the celebration effects, never server-rendered). Mirrors
 * `useWebGLEnabled` but without the deferred-mount dance.
 */
export function webGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return hasWebGL();
}

/**
 * One-shot probe: can this browser create a WebGL2 context? We require WebGL2
 * (not just WebGL1) because the celebration bloom pass needs it, and WebGL2 is
 * near-universal — anything older falls back to the CSS/DOM visuals everywhere.
 */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}
