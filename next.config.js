// Set default timezone for local dev/build (process-wide). Applies to dev and build steps only;
// production standalone server relies on the container environment (see Dockerfile and docker-compose.yml).
process.env.TZ = process.env.TZ || 'Etc/GMT+8';

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
  },
};

module.exports = nextConfig;
