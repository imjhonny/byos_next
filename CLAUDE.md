# byos_next — Claude Code Context

## Overview
Self-hosted TRMNL server (BYOS = Bring Your Own Server). A Next.js app that
serves image screens to a physical TRMNL e-ink display device. Screens are
React components rendered to HTML, then converted to a bitmap via headless
Chrome (chromedp) and sent to the device.

Forked from github.com/usetrmnl/byos_next.
Deployed to the HomeLab k8s cluster at https://byos.imjhonny.com.

## Working Style
- **Ask before assuming**: Clarify requirements before starting work.
- **No git operations**: Do not commit, push, or perform git operations unless explicitly asked.
- **Learning by doing**: Explain concepts before implementing each step.

---

## How it works

```
TRMNL device wakes up every X minutes
        ↓
GET /api/display on byos.imjhonny.com
        ↓
Next.js renders a React component to HTML
        ↓
headless Chrome (chromedp) takes a screenshot
        ↓
image converted to 1-bit bitmap (black & white, e-ink format)
        ↓
image returned to device → displayed → device sleeps
```

---

## Build & deploy steps

### Step 1 — Environment variables (byos_next repo)
Understand what config the app needs from `.env.example`.

Required:
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | 32+ char random secret for auth |
| `BETTER_AUTH_URL` | Public URL of the instance (https://byos.imjhonny.com) |
| `AUTH_ENABLED` | Set to `false` for single-user mode |
| `REACT_RENDERER` | Use `browser` for k8s (chromedp is bundled in Docker image) |
| `NODE_ENV` | `production` |

Optional:
| Variable | Description |
|---|---|
| `WIKIPEDIA_ACCESS_TOKEN` | For Wikipedia plugin |
| `ENABLE_EXTERNAL_CATALOG` | Set to `true` to fetch community plugins |

### Step 2 — GitHub Actions CI (byos_next repo)
Create `.github/workflows/release.yml` to build and push Docker image to
`ghcr.io/imjhonny/byos_next:<sha>` on every push to `main`.

**Note:** Image must be built for `linux/arm64` (Raspberry Pi).
The base image `chromedp/headless-shell` must have an arm64 variant available.

### Step 3 — HomeLab k8s manifests (HomeLab repo)
Create `k8s/trmnl/` with:

```
k8s/trmnl/
├── namespace.yml        → namespace: trmnl
├── postgres/
│   ├── pvc.yml          → 5Gi storage for PostgreSQL data
│   ├── secret.yml       → POSTGRES_PASSWORD (via Ansible secrets.yml)
│   └── deployment.yml   → PostgreSQL 17 deployment + ClusterIP service
├── secret.yml           → DATABASE_URL, BETTER_AUTH_SECRET (via Ansible)
├── configmap.yml        → BETTER_AUTH_URL, AUTH_ENABLED, REACT_RENDERER, NODE_ENV
├── pvc.yml              → storage for Next.js cache
├── deployment.yml       → byos_next deployment + ClusterIP service
├── ingress.yml          → byos.imjhonny.com → TLS via cert-manager
└── migrations-job.yml   → k8s Job that runs SQL migrations on first deploy
```

Ansible secrets to add to `secrets.yml` and `secrets.yml.example`:
- `byos_postgres_password` — PostgreSQL password
- `byos_auth_secret` — BETTER_AUTH_SECRET (min 32 chars, generate randomly)
- `byos_database_url` — full postgres:// connection string

### Step 4 — Database migrations (HomeLab repo)
Run all 22 SQL migration files against PostgreSQL before the app starts.
Use a Kubernetes **Job** with an init container pattern:
- Init container: wait for PostgreSQL to be ready
- Main container: run `psql` against each migration file in order

**Why init containers?** They run and complete before the main app pod starts.
Like a setup script that must finish before the real work begins.

### Step 5 — Point the TRMNL device
In the TRMNL device settings (via USB or its web interface):
- Set the server URL to `https://byos.imjhonny.com`
- Set the API key (generated in the byos_next admin UI after first login)
- Confirm the device polls and receives an image

### Step 6 — Custom screens (byos_next repo)
Add screens as React components in `components/screens/` or `app/screens/`.

Planned screens:
1. **Homelab stats** — query Prometheus HTTP API for CPU, memory, disk, pod count, alerts
2. **SL departures** — query ResRobot v2 API for next buses from 3 stops near home to T-Centralen

For each screen:
- React component renders HTML/Tailwind
- E-ink constraints: black & white only, no animations, simple layouts
- Data fetched server-side (Next.js server components or API routes)

---

## Repository structure (key files)

```
byos_next/
├── app/
│   ├── api/             ← API routes (including /api/display — device polling endpoint)
│   └── ...              ← Next.js pages
├── components/
│   └── screens/         ← Screen React components (add custom screens here)
├── lib/
│   ├── database/        ← PostgreSQL client (Kysely ORM)
│   └── recipes/         ← Built-in screen recipes
├── migrations/          ← 22 SQL migration files (run in order on first deploy)
├── data/trmnl/          ← Local cache of TRMNL API data (offline mode)
├── Dockerfile           ← Multi-stage: node builder + chromedp/headless-shell runtime
├── .env.example         ← All required environment variables with descriptions
└── CLAUDE.md            ← this file
```

## Key concepts

| Concept | Description |
|---|---|
| **Next.js** | React framework with built-in server. Pages + API routes in one project |
| **Server components** | React components that run on the server, not the browser. Can query DB directly |
| **Kysely** | TypeScript SQL query builder used for all database access |
| **chromedp/headless-shell** | Headless Chrome that renders HTML to a screenshot for e-ink conversion |
| **pnpm** | Fast package manager (like npm but more efficient) |
| **Biome** | Linter + formatter (replaces ESLint + Prettier) |

## E-ink screen constraints
- **Black and white only** — no color, no gradients
- **800×480px** — fixed resolution (TRMNL device screen size)
- **No animations** — static image only
- **Simple layouts** — high contrast, large text, clear hierarchy
- **Refresh rate** — device polls every few minutes, not real-time

## External APIs used in custom screens

### Prometheus (homelab stats)
- Base URL: `http://prometheus-monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090`
- Internal k8s DNS — no auth needed from within the cluster
- Query endpoint: `/api/v1/query?query=<PromQL>`

### ResRobot v2 (SL departures)
- Base URL: `https://api.resrobot.se/v2.1`
- Requires API key from trafiklab.se
- Endpoint: `/departureBoard?id=<stopId>&accessId=<apiKey>&format=json`
- Stop IDs found via `/location.name` endpoint or sl.se URLs

## Secrets reference (HomeLab Ansible)
| Ansible var | k8s target | Description |
|---|---|---|
| `byos_postgres_password` | `trmnl` namespace Secret | PostgreSQL password |
| `byos_auth_secret` | `trmnl` namespace Secret | BETTER_AUTH_SECRET |
| `byos_database_url` | `trmnl` namespace Secret | Full DATABASE_URL |
| `resrobot_api_key` | `trmnl` namespace Secret | Trafiklab ResRobot API key |
