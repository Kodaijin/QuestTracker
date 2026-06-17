// Next.js instrumentation hook (runs once on server boot). The actual scheduler
// lives in a node-only module imported behind a NEXT_RUNTIME guard, so the
// edge compilation never pulls in node-only deps (web-push → net/http/https).

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
