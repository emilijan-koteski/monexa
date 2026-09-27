# Monexa

Personal finance and expense tracking app with multi-currency support. Go backend + React frontend.

## What you need

- [Go](https://go.dev/) 1.25 (see `go.mod`)
- [Node.js](https://nodejs.org/) 22
- [Docker](https://www.docker.com/) with Compose

`mise install` picks up both tool versions from `mise.toml`.

## Development setup

The database runs in Docker; backend and frontend run on your machine for hot reload.

**1. Environment variables**

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

The example values work as-is locally. `.env` files are git-ignored; never commit real secrets.

**2. Start the database**

```bash
docker compose up -d
```

PostgreSQL listens on `localhost:5433` (`postgres` / `postgres`, database `monexa`). If you used the previous compose file, run `docker compose down --remove-orphans` once to retire the old `psql_monexa` container.

**3. Run the backend**

```bash
go run ./cmd/api
```

The API listens on `http://localhost:9000` (`PORT` in `.env`). Migrations run on startup.

**4. Run the frontend**

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Everything in Docker

Builds the same images that production uses and runs them next to Postgres (needs `.env` from step 1):

```bash
docker compose --profile app up --build
```

UI on `http://localhost:3000`, API on `http://localhost:9000`.

## Tests

```bash
go test ./...
cd frontend && npm run lint
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
