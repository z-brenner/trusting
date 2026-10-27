# Deployment behind a reverse proxy

Trusting listens on plain HTTP (port 3000 in the container). In production put a reverse proxy
in front of it that terminates TLS. This page shows minimal, working configurations for Caddy,
nginx and Traefik, and the two settings that must match your proxy.

## The two settings that must be right

| Setting | Value | Why |
| --- | --- | --- |
| `APP_URL` | the exact public URL, e.g. `https://trust.example.com` (no trailing slash) | Used for links in emails, OAuth redirect URIs and the CSRF origin check. If it does not match what the browser sees, uploads and forms are rejected as cross-site and OAuth callbacks fail. |
| `TRUST_PROXY` | `true` | Makes Trusting read the client IP from `X-Forwarded-For` / `X-Real-IP` for rate limiting and the audit log. Leave `false` if the app is reached directly. |

Two more things to know:

- In production (`NODE_ENV=production`, which the image sets) the session cookie carries the
  `Secure` flag. Signing in therefore only works over **HTTPS** (or on `localhost`). If you test
  the stack on a plain `http://server-ip:3000` address, the login will appear to loop.
- The proxy's **request body limit must be at least `MAX_UPLOAD_MB`** (default 25 MB), plus a
  little headroom for the multipart envelope, or uploads fail with HTTP 413 at the proxy.

Trusting does not use WebSockets. Responses may be streamed, so disable proxy buffering where
the proxy buffers by default (nginx).

## Caddy (recommended)

Caddy obtains and renews TLS certificates automatically and sets the forwarding headers by
default. Install Caddy on the host (or run it as another Compose service) and use this
`Caddyfile`:

```caddyfile
trust.example.com {
	encode zstd gzip
	request_body {
		max_size 30MB   # >= MAX_UPLOAD_MB
	}
	reverse_proxy 127.0.0.1:3000
}
```

If Caddy runs inside the same Compose project, replace `127.0.0.1:3000` with `app:3000`, remove
the `ports:` entry of the `app` service, and publish 80/443 on the Caddy container:

```yaml
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on: [app]
```

Set `APP_URL=https://trust.example.com` and `TRUST_PROXY=true` in `.env`, then
`docker compose up -d`.

## nginx

```nginx
server {
    listen 80;
    server_name trust.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trust.example.com;

    ssl_certificate     /etc/letsencrypt/live/trust.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trust.example.com/privkey.pem;

    # Must be >= MAX_UPLOAD_MB (default 25 MB); multipart needs a little headroom.
    client_max_body_size 30m;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        # Next.js streams responses; do not buffer them.
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

Use Certbot (or your CA of choice) for the certificate. No WebSocket upgrade headers are needed.

## Traefik

With Traefik already running and attached to a Docker network (here `proxy`), label the `app`
service and remove its `ports:` entry:

```yaml
services:
  app:
    # ... existing configuration ...
    networks: [default, proxy]
    labels:
      traefik.enable: "true"
      traefik.http.routers.trusting.rule: Host(`trust.example.com`)
      traefik.http.routers.trusting.entrypoints: websecure
      traefik.http.routers.trusting.tls.certresolver: letsencrypt
      traefik.http.services.trusting.loadbalancer.server.port: "3000"
      # Body size limit (>= MAX_UPLOAD_MB). 31457280 bytes = 30 MB.
      traefik.http.middlewares.trusting-body.buffering.maxRequestBodyBytes: "31457280"
      traefik.http.routers.trusting.middlewares: trusting-body

networks:
  proxy:
    external: true
```

Traefik forwards `X-Forwarded-For` and `X-Forwarded-Proto` by default. If Traefik itself sits
behind another proxy or load balancer, configure `forwardedHeaders.trustedIPs` on the entrypoint
so the real client IP is passed on.

## Checklist after wiring up the proxy

1. `curl -I https://trust.example.com/api/health` returns `200` and `{"ok":true,...}`.
2. Sign in at `https://trust.example.com/login`; if you are bounced back to the login page, the
   cookie is not being set, which almost always means the site is not actually served over HTTPS
   or `APP_URL` is wrong.
3. Upload a document as large as your `MAX_UPLOAD_MB` to confirm the proxy body limit.
4. Check `docker compose logs app` once: with `TRUST_PROXY=true` the audit log should show real
   client addresses rather than the proxy's.

## Running several replicas

Trusting is designed as one instance per organisation. If you nevertheless run replicas behind a
load balancer: rate limits are per process (add limits at the proxy), run migrations once with
`docker compose run --rm app migrate` and start replicas with `SKIP_MIGRATIONS=true`, and use
`STORAGE_DRIVER=s3` (not `local`) so all replicas see the same files.
