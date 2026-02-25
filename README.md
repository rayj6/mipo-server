# Mipo Server

Backend for the Mipo photobooth app. Provides templates, strip generation, and authentication.

## Structure

```
mipo-server/
├── index.js              # Entry: runs migrations, then starts app
├── src/
│   ├── config/           # Env and app config
│   ├── db/               # MySQL connection and migrations
│   ├── middleware/       # Auth (JWT), rate limiting
│   ├── controllers/      # Auth controller
│   ├── routes/           # Auth + API (templates, backgrounds, generate-strip)
│   ├── services/         # In-memory temp photo store
│   ├── constants/        # Template definitions
│   ├── utils/            # getBaseUrl, etc.
│   └── app.js            # Express app (helmet, cors, routes)
├── lib/                  # stripImage, removeBg
└── public/               # Static assets, HTML templates
```

## Setup

1. Copy `.env.example` to `.env` and set:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (MySQL)
   - `JWT_SECRET` (long random string, e.g. 32+ chars)
2. Ensure MySQL is running and the database user can create DB/tables.
3. Run `npm install` then `npm start`.

On startup, the server runs migrations: creates the database if missing and the `users` and `password_reset_tokens` tables.

## API

- **Auth** (rate-limited): `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (Bearer), `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- **API**: `GET /api/templates`, `GET /api/backgrounds`, `POST /api/temp-upload`, `POST /api/generate-strip`, `GET /api/temp/:id`
- **Health**: `GET /health`
