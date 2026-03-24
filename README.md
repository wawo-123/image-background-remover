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
- Drag-and-drop upload flow
- Clear loading, success, empty, and error states
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

## Cloudflare deployment prep
This repository is now prepared at the application level for a Cloudflare deployment path:

- no persistent upload storage in the MVP flow
- server route reads `REMOVE_BG_API_KEY` from environment variables
- UI and API are kept simple for adapter/runtime migration later

A helper note script is included:

```bash
npm run cf:deploy:note
```

When you move to Cloudflare, the remaining work is mainly choosing the exact Next.js-on-Cloudflare deployment adapter/runtime and wiring the environment variable in the target platform.

## Notes
- The current MVP does not persist uploaded images.
- Images are processed per request.
- `.env.local` is local-only and should never be committed.
