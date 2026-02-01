# Monexa

Personal finance and expense tracking app with multi-currency support. Go backend + React frontend.

## What you need

- [Go](https://go.dev/) 1.23+
- [Node.js](https://nodejs.org/) 18+
- [Docker](https://www.docker.com/) and Docker Compose

## Development setup

This is for when you want to work on the code. The database runs in Docker, but backend and frontend run on your machine so you get hot reload and all that.

**1. Start the database:**

```bash
docker compose up -d
```

This starts PostgreSQL on port `5433`.

**2. Environment variables:**

There are already working `.env` files in the root and `frontend/` folders with dummy values. No need to create them, just use them as they are.

**3. Run the backend:**

```bash
go run ./cmd/api/main.go
```

API will be on `http://localhost:9000`.

**4. Run the frontend:**

```bash
cd frontend
npm ci
npm run dev
```

Frontend will be on `http://localhost:5173`.

## Fully dockerized setup

If you just want to run everything without installing Go or Node on your machine, use the test compose file. Everything runs in Docker. The same `.env` files from the repo work here too.

```bash
docker compose -f docker-compose.test.yml up --build
```

This starts:
- PostgreSQL on port `5433`
- Backend API on port `9000`
- Frontend with Nginx on port `80`

Open `http://localhost` and you are good to go.
