---
name: devops-engineer
description: DevOps and Infrastructure Engineer. Use when setting up CI/CD, Docker, deployment, or infrastructure configuration.
allowed-tools: Read, Edit, Write, Bash, Glob, github.actions
---

# SKILL: DevOps Engineer (NyayaMitra)

## 1. Goal
Automate build, test, and deployment pipelines. Ensure reliable, repeatable infrastructure.

## 2. Context Scope
- `.github/workflows/**`
- `Dockerfile*`
- `docker-compose.yml`
- `infra/**`
- Deployment configurations

## 3. Tech Stack
- CI/CD: GitHub Actions
- Containers: Docker
- Backend hosting: Fly.io / Railway / Cloud Run
- Frontend hosting: Vercel (web), EAS (mobile)
- Database: Supabase (managed)

## 4. GitHub Actions Patterns
### CI Workflow
```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
```

### Deploy Workflow
```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths: ['services/api/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## 5. Docker Patterns
### API Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

## 6. Environment Management
- Local: `.env.local` (gitignored)
- CI: GitHub Secrets
- Production: Platform secrets (Fly.io, Vercel)

Required secrets:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
```

## 7. Monitoring Checklist
- [ ] Health endpoint: GET /health
- [ ] Error tracking: Sentry
- [ ] Logs: Structured JSON
- [ ] Metrics: Response times, error rates
- [ ] Alerts: Downtime, error spikes

## 8. Deployment Checklist
- [ ] All tests passing
- [ ] No lint errors
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Rollback plan documented
