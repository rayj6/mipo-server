# Mipo Server – Scaling for 1M+ Users

This document describes the scaling measures in place and recommended production setup.

## Current Measures

### Database
- **Connection pool**: Configurable via `DB_POOL_SIZE` (default 100) and `DB_QUEUE_LIMIT` (default 500). Prevents connection exhaustion under load.
- **Indexes**: `templates.is_free` is indexed for fast filtering of free/paid templates. `users.email`, `password_reset_tokens` have appropriate indexes.
- **Migrations**: Run once on startup; ensure DB is provisioned with enough connections (e.g. `max_connections` in MySQL ≥ sum of pool sizes across app instances).

### Rate limiting
- **Auth**: 20 requests per 15 minutes per IP (login/register).
- **Password reset**: 5 per hour per IP.
- **API (general)**: 120 requests per minute per IP for all `/api/*` (templates, backgrounds, temp, etc.).
- **Heavy endpoints**: 20 requests per minute per IP for `POST /api/temp-upload` and `POST /api/generate-strip`.

### Temp photo storage
- **In-memory** with TTL and cap:
  - `TEMP_PHOTOS_TTL_MS` (default 1 hour): entries expire and are cleaned every 5 minutes.
  - `TEMP_PHOTOS_MAX` (default 10,000): when exceeded, oldest 10% are evicted.
- For very high traffic or multi-instance deployment, replace with **Redis** or object storage (S3) with short-lived URLs and update `src/services/tempPhotos.js` accordingly.

### Async I/O
- **Backgrounds list**: Uses `fs.promises.readdir` instead of sync `readdirSync` so the event loop is not blocked.

### Health checks
- `GET /health`: Returns `{ status: 'ok' }` (no DB check).
- `GET /health/ready`: Returns 200 if DB is reachable (`SELECT 1`), 503 otherwise. Use for Kubernetes/orchestrator readiness probes.

### CORS
- Optional: set `CORS_ORIGINS` (comma-separated list of allowed origins). If unset, all origins are allowed. For production, set e.g. `CORS_ORIGINS=https://yourapp.com,https://admin.yourapp.com`.

### Error handling
- Global 4-arg error middleware catches unhandled errors and returns 500 with a generic message.

## Environment variables (scaling-related)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_SIZE` | 100 | Max DB connections in the pool per process. |
| `DB_QUEUE_LIMIT` | 500 | Max queued DB requests when pool is full. |
| `TEMP_PHOTOS_MAX` | 10000 | Max in-memory temp photo entries. |
| `TEMP_PHOTOS_TTL_MS` | 3600000 | TTL for temp photos (1 hour). |
| `CORS_ORIGINS` | (all) | Comma-separated allowed origins. |

## Horizontal scaling

- The app is **stateless** except for in-memory temp photos. To run multiple instances:
  1. Put a **load balancer** in front (e.g. nginx, cloud LB).
  2. Use **Redis** (or similar) for temp photos so all instances share the same store; or use object storage and short-lived URLs.
  3. Ensure **MySQL** can handle the total number of connections (instances × `DB_POOL_SIZE`). Consider a **read replica** for template/user reads if needed.
  4. Optionally add **caching** (e.g. Redis) for `GET /api/templates` and template HTML to reduce DB load.

## Heavy workload: generate-strip

- `POST /api/generate-strip` does CPU work (image processing) and optional remove.bg API calls. It is rate-limited (20/min per IP).
- For 1M users, consider:
  - **Queue-based processing**: Push jobs to a queue (e.g. Bull + Redis), return a job ID, and let the client poll or use webhooks for the result. This keeps HTTP connections short and allows many workers.
  - **Request timeout**: Ensure reverse proxy or load balancer has a higher timeout (e.g. 120s) for this route.
  - **Separate worker pool**: Run strip generation in dedicated worker processes so the main API stays responsive.

## Checklist for production (1M users)

- [ ] Set `DB_POOL_SIZE` and `DB_QUEUE_LIMIT` according to instance count and DB `max_connections`.
- [ ] Set `CORS_ORIGINS` to your app and admin origins.
- [ ] Use `GET /health/ready` for readiness probes.
- [ ] Plan for Redis or object storage for temp photos if running multiple instances.
- [ ] Consider queue + workers for `generate-strip` and caching for template list/HTML.
- [ ] Monitor DB connection usage, response times, and rate-limit hits.
