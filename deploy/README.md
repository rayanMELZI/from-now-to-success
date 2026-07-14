# Deploying to the Proxmox VM

Everything is driven by the CI/CD pipeline (`.github/workflows/ci.yml`):
every merge to `main` tests → publishes images → deploys to the VM.
The pipeline writes `/opt/fnts/.env` (from GitHub secrets) and
`/opt/fnts/compose.prod.yml` on every deploy — you never edit files on the VM.

SSH to the VM goes through a **Cloudflare Tunnel** (`cloudflared access ssh`),
so the VM exposes nothing to the internet. CI authenticates to Cloudflare
Access with a **service token** instead of a browser login.

## One-time setup (the part no pipeline can do)

On the VM:

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy    # log out/in afterwards

# 2. App directory owned by the SSH user
sudo mkdir -p /opt/fnts && sudo chown deploy /opt/fnts

# 3. A dedicated CI deploy key (generate anywhere):
#    ssh-keygen -t ed25519 -f fnts_deploy -N ""
# put fnts_deploy.pub into ~deploy/.ssh/authorized_keys on the VM;
# the PRIVATE file becomes the DEPLOY_KEY secret below.
```

In the Cloudflare Zero Trust dashboard:

1. **Access → Service Auth → Service Tokens → Create** — note the
   Client ID and Client Secret (shown once).
2. **Access → Applications →** your SSH application (the one covering
   the tunnel hostname) **→ Policies → Add**: action **Service Auth**,
   include → Service Token → the token from step 1.

## GitHub configuration (Settings → Secrets and variables → Actions)

Secrets:

| Secret                   | Value |
|--------------------------|-------|
| `DEPLOY_HOST`            | the tunnel hostname (e.g. `nanovm.example.dev`) |
| `DEPLOY_USER`            | SSH user on the VM (e.g. `deploy`) |
| `DEPLOY_KEY`             | contents of the private key file (`fnts_deploy`) |
| `CF_ACCESS_CLIENT_ID`    | service token Client ID |
| `CF_ACCESS_CLIENT_SECRET`| service token Client Secret |
| `POSTGRES_PASSWORD` | any strong password (`openssl rand -base64 24`) |
| `JWT_SECRET`        | `openssl rand -base64 48` |
| `VAPID_PUBLIC_KEY`  | from `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | from the same command |
| `VAPID_SUBJECT`     | `mailto:you@example.com` |

Variables (not secret):

| Variable         | Value |
|------------------|-------|
| `SECURE_COOKIES` | `false` until HTTPS is set up, then `true` |

Then push to `main` — the pipeline does the rest. The app appears on
`http://<vm-ip>:3000`.

## HTTPS (required for web push)

Browsers only allow service workers / push on HTTPS (or localhost).
Simplest: Caddy on the VM with automatic certificates:

```
# /etc/caddy/Caddyfile
yourdomain.example {
    reverse_proxy localhost:3000
}
```

Then set the `SECURE_COOKIES` variable to `true` and re-run the deploy
(Actions → CI → Re-run → deploy, or just push again).

## Rollback

Actions → CI → pick the last good run → "Re-run" the deploy job: it redeploys
that run's exact `sha-…` image tag.

## Database backups

Data lives in the `db-data` Docker volume. Simple nightly dump on the VM:

```bash
# /etc/cron.daily/fnts-backup (chmod +x)
#!/bin/sh
cd /opt/fnts
docker compose -f compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > /opt/fnts/backups/fnts-$(date +%F).sql.gz
find /opt/fnts/backups -mtime +14 -delete
```
