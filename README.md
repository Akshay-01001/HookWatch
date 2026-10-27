# HookWatch

A webhook monitoring SaaS monorepo.

## Project Structure

```
HookWatch/
├── apps/
│   ├── web/        # Next.js 16 App Router (@hook-watch/web)
│   └── worker/     # Node.js TypeScript BullMQ worker (@hook-watch/worker)
├── packages/
│   ├── database/   # Prisma ORM 7 + PostgreSQL (@hook-watch/database)
│   └── queue/      # BullMQ + ioredis (@hook-watch/queue)
├── docker-compose.yml
└── package.json
```

---

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example `.env` files:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
cp packages/database/.env.example packages/database/.env
```

### 3. Start Database & Redis

```bash
docker compose up -d
```

### 4. Generate Prisma Client & Run Migrations

```bash
npm run db:generate
npm run db:migrate:dev
```

### 5. Build Shared Packages

```bash
npm run build:packages
```

---

## Development

Run the web app and worker in separate terminals:

```bash
# Terminal 1: Next.js frontend (http://localhost:3000)
npm run dev:web

# Terminal 2: Background worker
npm run dev:worker
```

---

## Production Build & Start

```bash
# Build all workspaces
npm run build

# Start services
npm run start:web     # Next.js web application
npm run start:worker  # Compiled worker (dist/index.js)
```

---

## Useful Commands

| Command | Description |
|---|---|
| `docker compose up -d` | Start PostgreSQL & Redis |
| `docker compose down` | Stop PostgreSQL & Redis (preserves data) |
| `docker compose logs -f` | View container logs |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate:dev` | Apply migrations in development |
| `npm run db:migrate:deploy` | Apply migrations in production/CI |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run typecheck` | Run type checking across all workspaces |
| `npm run build` | Build shared packages, web app, and worker |
