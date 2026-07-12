# fromNowToSuccess

A habit tracker where your habits form a **roadmap**: basic habits unlock advanced
ones. Do a habit enough days in a row and it becomes **valid**, opening the next
cells on the map — from *now* to *success*.

## The rules

- A habit needs a streak of `requiredStreak` days to become **valid**.
- Missing one day is forgiven. Two misses in a row reset the streak.
  Three misses in a row demote a valid habit.
- A locked habit unlocks when **all** its prerequisites are valid.
- Points: `basePoints × streak multiplier` (×1.5 at 7 days, ×2 at 14, ×3 at 30),
  +5 per daily check-in, +50 when a habit becomes valid. Misses never cost points.
- A browser push notification asks about your day at your chosen hour —
  only on days you haven't checked in yet.

## Stack

| Piece    | Tech |
|----------|------|
| Backend  | Spring Boot 4 (Java 24), PostgreSQL, Flyway, JWT + refresh cookies |
| Frontend | Next.js 16, TypeScript, Tailwind 4, custom SVG roadmap |
| Infra    | Docker Compose, GitHub Actions → GHCR, deployed on a VM |

## Run it

```bash
cp .env.example .env    # fill in JWT_SECRET and VAPID keys (commands are in the file)
docker compose up --build
# open http://localhost:3000
```

### Local development (without Docker for the app itself)

```bash
# database
docker run -d --name fnts-dev-db -e POSTGRES_USER=fnts -e POSTGRES_PASSWORD=fnts \
  -e POSTGRES_DB=fnts -p 5434:5432 postgres:16-alpine

# backend (needs DB_URL=jdbc:postgresql://localhost:5434/fnts, JWT_SECRET, VAPID_* env vars)
cd backend && ./mvnw spring-boot:run

# frontend (proxies /api to localhost:8080)
cd frontend && npm run dev
```

### Tests

```bash
cd backend && ./mvnw verify
cd frontend && npm run lint && npm run build
```

## Deploy

See [deploy/README.md](deploy/README.md) for the VM setup and the
GitHub Actions pipeline (`.github/workflows/`).
