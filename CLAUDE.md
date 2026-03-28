# PVQ-TM — Public Vocational Quotient Transferability Method

## Tech Stack
- **Frontend/Backend**: Next.js 16 (App Router, Turbopack)
- **Database**: PostgreSQL via Prisma 7 (with @prisma/adapter-pg)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Testing**: Vitest (1,026 tests across 19 suites)
- **Deployment**: Docker → Railway

## Key Directories
- `src/lib/engine/` — Calculation engine (PVQ, VQ, STQ, TFQ, feasibility)
- `src/data/` — Static occupation data (DOT, O*NET, ORS, OEWS, BLS, unified)
- `src/app/api/` — API routes
- `src/app/` — Pages (Next.js App Router)
- `scripts/build-unified/` — Build script for unified occupation dataset
- `prisma/` — Database schema and migrations

## Docker Workflow (IMPORTANT)

### Build and test locally BEFORE deploying:

```bash
# 1. Build the Docker image locally
docker build -t pvq-tm:local .

# 2. Run with local PostgreSQL
docker compose up -d

# 3. Verify it works
curl http://localhost:3000/api/unified-occupations?summary=groups

# 4. Check logs for errors
docker compose logs app

# 5. Tear down
docker compose down
```

### If Docker build fails:
- Check `.dockerignore` — `src/data/` must NOT be excluded
- The Dockerfile copies `src/data` explicitly into the runner stage
- JSON data files are imported at runtime and may not be traced by Next.js standalone output
- The `public/` directory is created if it doesn't exist

### Deploy to Railway:
```bash
# After local Docker test passes:
git push origin main
# Railway auto-deploys from main branch
```

## Common Commands

```bash
# Dev server
npm run dev

# Run tests
npx vitest run

# Build (same as Docker build step)
npm run build

# Generate Prisma client
npx prisma generate

# Rebuild unified occupation dataset
npx tsx scripts/build-unified/build.ts
```

## Unified Occupation System
The system uses a pre-computed unified dataset (`src/data/unified-occupations.json`) that merges:
- **DOT** (12,726 titles) — SVP, strength, GED
- **O*NET** (1,016 occupations) — skills, abilities, tasks, tools
- **ORS** (226 occupations) — physical/environmental demands
- **OEWS** (831 occupations) — wages, employment
- **BLS Projections** (832 occupations) — growth, openings

Each unified record is keyed by O*NET-SOC code and contains a pre-computed 24-trait demand vector with source provenance (ORS > DOT > O*NET priority).

To rebuild after updating source data:
```bash
npx tsx scripts/build-unified/build.ts
```

## Testing
- Always run `npx vitest run` before committing
- All 1,026 tests must pass
- Build must be clean: `npm run build`
