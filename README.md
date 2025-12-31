# Effect API Example

A monorepo example demonstrating how to build a type-safe API using [Effect](https://effect.website/), [@effect/platform](https://effect.website/docs/platform/http-api/introduction), and [Drizzle ORM](https://orm.drizzle.team/).

## Repository Structure

```
effect-api-example/
├── apps/
│   └── server/                 # Bun HTTP server
│       ├── src/
│       │   ├── api/
│       │   │   ├── groups/     # API endpoint handlers
│       │   │   └── middleware/ # Auth middleware implementations
│       │   ├── db/
│       │   │   ├── schema/     # Drizzle table schemas
│       │   │   ├── migrations/ # Database migrations
│       │   │   └── SqlLive.ts  # Database layer
│       │   └── main.ts         # Server entrypoint
│       ├── scripts/
│       │   ├── seed.ts         # Database seeding script
│       │   └── client-example.ts # Example API client
│       ├── docker-compose.yml  # PostgreSQL container
│       └── drizzle.config.ts   # Drizzle Kit configuration
├── packages/
│   ├── api/                    # API definition (schemas, endpoints, middleware)
│   │   └── src/definition/
│   │       ├── groups/         # Endpoint group definitions
│   │       ├── middleware/     # Middleware definitions
│   │       └── WarpApi.ts      # Main API definition
│   ├── shared/                 # Shared types and utilities
│   │   └── src/index.ts        # Branded types, schemas, helpers
│   ├── eslint-config/          # Shared ESLint configuration
│   └── typescript-config/      # Shared TypeScript configuration
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9+)
- [Bun](https://bun.sh/) (for running the server)
- [Docker](https://www.docker.com/) (for PostgreSQL)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd effect-api-example

# Install dependencies
pnpm install
```

## Running the Project

### 1. Start the Database

```bash
cd apps/server
docker compose up -d
```

This starts a PostgreSQL container with:
- Host: `localhost`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: `postgres_password`

### 2. Configure Environment

Copy the example environment file:

```bash
cd apps/server
cp .env.example .env
```

The `.env` file should contain:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USERNAME=postgres
DB_PASSWORD=postgres_password
```

### 3. Run Database Migrations

```bash
pnpm --filter @effect-api-example/server db:migrate
```

### 4. Seed the Database (Optional)

Populate the database with 1000 sample employees:

```bash
pnpm --filter @effect-api-example/server db:seed
```

### 5. Start the Server

```bash
pnpm --filter @effect-api-example/server dev
```

The server runs on `http://localhost:9277` by default.

### 6. Test the API (Optional)

Run the example client to test the API:

```bash
pnpm --filter @effect-api-example/server client:example
```

## Available Scripts

### Root

| Script | Description |
|--------|-------------|
| `pnpm build` | Build all packages |
| `pnpm dev` | Start development mode for all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |

### Server (`apps/server`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start server in hot-reload mode |
| `pnpm build` | Build server for production |
| `pnpm start` | Run production build |
| `pnpm db:generate` | Generate new migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm client:example` | Run example API client |

## API Endpoints

### Health

- `GET /health` - Health check endpoint

### Employees

All employee endpoints require an `x-api-key` header.

- `GET /employees` - List employees with pagination
  - Query params: `limit`, `afterId`, `beforeId`, `types[]`
- `GET /employees/:id` - Get employee by tag

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [@effect/platform](https://effect.website/docs/platform/http-api/introduction) HTTP API
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Type Safety**: [Effect Schema](https://effect.website/docs/schema/introduction)
- **Monorepo**: [Turborepo](https://turbo.build/repo) with pnpm workspaces
