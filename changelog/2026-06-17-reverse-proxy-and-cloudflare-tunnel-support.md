# 2026-06-17: Reverse-proxy and Cloudflare Tunnel support


- **`ALLOWED_ORIGINS`** env var feeding Next's `serverActions.allowedOrigins`, so mutations no longer return 500 when the proxy forwards a `Host` that differs from the browser `Origin`. Passed as a Docker build arg (baked into the standalone build). `NEXTAUTH_URL`'s host is trusted automatically
