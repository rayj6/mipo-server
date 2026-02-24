# Mipo Server

Minimal server for the Mipo photobooth app. Serves the strip template (HTML/CSS) and provides an API to store photos and get a strip URL.

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Runs at `http://localhost:3001` (or `PORT` in `.env`).

## What it does

- **GET /strip.html** – Photo strip template. Query params: `photo1`, `photo2`, `photo3`, `photo4` (image URLs), `slots` (2–4), `date`, `names`, `title`. The template matches the reference: light background, watercolor-style florals and butterflies at the edges, frames with wavy white borders, date and names in the footer (“and” in smaller italic pastel blue-grey).
- **POST /api/generate-strip** – Body: `{ photoBase64s: string[], slotCount?: number, title?, names?, date? }`. Stores photos temporarily and returns `{ success: true, stripUrl }`. Open `stripUrl` in a WebView to show the strip with your photos in the frames.
- **GET /api/temp/:id** – Serves a stored photo (used by the strip page).

Set `BASE_URL` in `.env` if the app runs on another device so the strip and temp URLs work (e.g. `BASE_URL=http://192.168.0.107:3001`).

## Public folder

- **strip.html** – The only required file. Add any other static assets (e.g. templates, backgrounds) under `public/` if needed.
