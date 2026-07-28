# fromNowToSuccess

A habit tracker where your habits form a **roadmap**: basic habits unlock advanced
ones. Do a habit enough days in a row and it becomes **valid**, opening the next
cells on the map — from *now* to *success*.

## The rules

- Every habit has a **gauge**: +1 per done day (capped at `requiredStreak`),
  −1 per miss. A **full gauge makes the habit valid**; a valid habit is only
  demoted when its gauge sinks below 60% of the requirement.
- Habits can be **daily, weekly, or monthly** (weekly/monthly are marked done
  during the period and auto-miss when it ends), and can **build** a good
  habit or **quit** a bad one (success = avoiding it).
- A locked habit unlocks when **all** its prerequisites are valid; a non-valid
  habit with a non-valid prerequisite is always locked.
- Points: `basePoints × streak multiplier` (×1.5 at 7, ×2 at 14, ×3 at 30),
  +5 for the first done answer of the day, +50 on validation. A miss costs
  `basePoints`; writing a reason halves the loss. The total never goes below 0.
- **3 streak freezes per month**: a frozen miss leaves gauge and streak untouched.
- Your day can end past midnight (night-owl setting) and your week can start
  on any day. Answer each habit the moment you know — no need to wait.
- A push notification asks about your day at your chosen hour — only on days
  you haven't finished checking in.
- The in-app feedback button sends ideas to the developer: each one is
  summarised and triaged by Gemini, then emailed with the raw text attached.
  Feedback is always stored first, so a failed briefing is retried, never lost.

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

### Tests

```bash
cd backend && ./mvnw verify
cd frontend && npm run lint && npm run build
```

## Deploy

See [deploy/README.md](deploy/README.md) for the VM setup and the
GitHub Actions pipeline (`.github/workflows/`).
