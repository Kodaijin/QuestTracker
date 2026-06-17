// Set default timezone for local dev/build (process-wide). Applies to dev and build steps only;
// production standalone server relies on the container environment (see Dockerfile and docker-compose.yml).
process.env.TZ = process.env.TZ || 'Etc/GMT+8';

// Behind a reverse proxy / tunnel (e.g. Cloudflare Tunnel), the forwarded Host
// header the app sees can differ from the browser's Origin, which makes Next's
// Server Actions origin check reject every mutation with a 500. Allow the public
// origin(s): from ALLOWED_ORIGINS (comma-separated host[:port], no protocol) and,
// for convenience, the host of NEXTAUTH_URL.
function allowedOrigins() {
  const origins = new Set();
  for (const o of (process.env.ALLOWED_ORIGINS || '').split(',')) {
    const v = o.trim();
    if (v) origins.add(v.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  }
  if (process.env.NEXTAUTH_URL) {
    try {
      origins.add(new URL(process.env.NEXTAUTH_URL).host);
    } catch {
      /* ignore malformed NEXTAUTH_URL */
    }
  }
  return Array.from(origins);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Enables src/instrumentation.ts register() — used to start the in-process
    // reminder scheduler on server boot (required flag on Next 14.2).
    instrumentationHook: true,
    // web-push is Node-only (net/http/https); keep it external so webpack
    // doesn't try to bundle it (and its proxy-agent deps) into server chunks.
    serverComponentsExternalPackages: ['web-push'],
    // Trust Server Action POSTs whose Origin is the public domain even when the
    // proxy forwards a different Host (otherwise mutations 500 behind a tunnel).
    serverActions: {
      allowedOrigins: allowedOrigins(),
    },
  },
};

module.exports = nextConfig;
