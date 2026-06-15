#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Starting server..."
exec node server.js
