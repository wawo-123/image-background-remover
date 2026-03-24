# Image Background Remover

A lightweight MVP for the keyword **image background remover** built with **Next.js + Tailwind CSS**.

## Stack
- Next.js
- TypeScript
- Tailwind CSS
- Remove.bg API

## Features in this MVP
- Single image upload (JPG / PNG / WEBP)
- File size validation (10MB max)
- Remove.bg API integration through a server route
- Before / After preview
- Transparent PNG download
- SEO-oriented landing page sections and FAQ
- `docs/mvp.md` included in the repository

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Copy `.env.example` to `.env.local` and fill in your Remove.bg key:

```bash
cp .env.example .env.local
```

Required variable:

```bash
REMOVE_BG_API_KEY=your_remove_bg_api_key_here
```

## Notes
- The current MVP does not persist uploaded images.
- Images are processed per request.
- For production deployment to Cloudflare later, the server-side route may need adaptation depending on the runtime target.
