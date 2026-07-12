# Deploying to the Proxmox VM

One-time VM setup, then every deploy is one click in GitHub Actions.

## 1. One-time VM setup

On a Debian/Ubuntu VM:

```bash
# Docker (official convenience script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in afterwards

# App directory
sudo mkdir -p /opt/fnts && sudo chown $USER /opt/fnts
```

Copy `compose.prod.yml` to `/opt/fnts/`, and create `/opt/fnts/.env` based on
`.env.example` from the repo root, plus these two extra variables:

```bash
IMAGE_OWNER=<your-github-username>   # lowercase
IMAGE_TAG=latest
```

Generate real secrets on the VM:

```bash
openssl rand -base64 48          # -> JWT_SECRET
npx web-push generate-vapid-keys # -> VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

If the GHCR packages are private, log the VM into GHCR once:

```bash
docker login ghcr.io -u <github-username>   # password = a PAT with read:packages
```

First start:

```bash
cd /opt/fnts
docker compose -f compose.prod.yml up -d
```

The app is now on `http://<vm-ip>:3000`.

## 2. HTTPS (required for web push)

Browsers only allow service workers / push on HTTPS (or localhost). Put a
reverse proxy with TLS in front of port 3000 — pick one:

- **Caddy** (simplest, automatic certificates):
  ```
  # /etc/caddy/Caddyfile
  yourdomain.example {
      reverse_proxy localhost:3000
  }
  ```
- Nginx + certbot, or a Proxmox-level proxy if you already run one.

Then set `SECURE_COOKIES=true` in `/opt/fnts/.env` and
`docker compose -f compose.prod.yml up -d` again.

## 3. Deploys after that

GitHub → Actions → **Deploy to VM** → Run workflow. It SSHes into the VM,
pulls the images CI published, and restarts the stack.

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret        | Value |
|---------------|-------|
| `DEPLOY_HOST` | VM IP or domain |
| `DEPLOY_USER` | SSH user on the VM |
| `DEPLOY_KEY`  | Private SSH key; its `.pub` goes in the VM's `~/.ssh/authorized_keys` |

## 4. Database backups

The data lives in the `db-data` Docker volume. Simple nightly dump:

```bash
# /etc/cron.daily/fnts-backup (chmod +x)
#!/bin/sh
docker compose -f /opt/fnts/compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /opt/fnts/backups/fnts-$(date +%F).sql.gz
find /opt/fnts/backups -mtime +14 -delete
```
