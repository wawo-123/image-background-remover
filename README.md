# Image Background Remover

A lightweight MVP for the keyword **image background remover** built with **Next.js + Tailwind CSS**.

## Stack
- Next.js
- TypeScript
- Tailwind CSS
- Remove.bg API
- OpenNext for Cloudflare
- Wrangler

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

## Cloudflare deployment
This repository is now prepared for a Cloudflare deployment path using **OpenNext for Cloudflare**.

### Installed tooling
- `@opennextjs/cloudflare`
- `wrangler`

### Added files
- `wrangler.jsonc`
- `open-next.config.ts`
- `.dev.vars.example`

### Available scripts
```bash
npm run cf:build
npm run cf:preview
npm run cf:deploy
```

### Before first deploy
1. Log in to Cloudflare:
   ```bash
   npx wrangler auth login
   ```
2. Set your production env var in Cloudflare for the worker:
   - `REMOVE_BG_API_KEY`
3. (Optional) Create a local `.dev.vars` from `.dev.vars.example` for Wrangler local preview.

### Local Cloudflare preview
```bash
npm run cf:preview
```

### Deploy
```bash
npm run cf:deploy
```

## Notes
- The current MVP does not persist uploaded images.
- Images are processed per request.
- `.env.local` is local-only and should never be committed.
