// Set default timezone for local dev/build (process-wide). Applies to dev and build steps only;
// production standalone server relies on the container environment (see Dockerfile and docker-compose.yml).
process.env.TZ = process.env.TZ || 'Etc/GMT+8';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
