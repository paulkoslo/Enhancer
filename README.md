# Enhancer

Spreadsheet Research Agent monorepo.

## Layout

- `apps/api`: FastAPI backend, orchestration, persistence, worker entrypoints.
- `apps/web`: Next.js frontend.
- `packages/enhancer-sdk`: Python SDK exposed to sandboxed generated code.

## Local Development

### Backend

1. Create a Python virtual environment.
2. Install `apps/api` and `packages/enhancer-sdk`.
3. Run `uvicorn app.main:app --reload --app-dir apps/api`.

### Frontend

1. Install workspace dependencies with `npm install`.
2. Run `npm run dev --workspace web`.

## Environment

Backend settings are loaded from environment variables:

- `ENHANCER_DATABASE_URL`
- `ENHANCER_REDIS_URL`
- `ENHANCER_OPENROUTER_API_KEY`
- `ENHANCER_ENCRYPTION_SECRET`
- `ENHANCER_STORAGE_ROOT`
- `ENHANCER_ENABLE_ADVANCED_SANDBOX`

The frontend expects:

- `NEXT_PUBLIC_API_BASE_URL`
