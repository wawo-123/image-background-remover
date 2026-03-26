# AI Photo Studio

An online photo workflow built with Next.js for three practical jobs:

- Batch background removal
- ID photo generation with multiple sizes, colors, and styles
- AI-style object erasing with brush-based masking and smart fill

## What changed in this version

### 1. Background removal
- Supports selecting multiple images at once
- Selected images appear directly in the upload area
- The upload button changes to **重新选择图片** after files are selected
- Batch processing and per-image downloads are supported
- Technical stack / MVP marketing sections were removed from the page

### 2. ID photo maker
- Upload one portrait photo
- Remove background first
- Generate ID photos with:
  - multiple size presets
  - multiple background colors
  - multiple portrait styles
- Export result as PNG

### 3. AI eraser
- Upload an image
- Brush over the object / passerby / unwanted area
- Use OpenCV inpainting in the browser for intelligent fill-style removal
- Export result as PNG

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

### Available scripts
```bash
npm run build
npm run cf:build
npm run cf:deploy
```

### Production note
Do not deploy directly after code changes if a manual review is required.
Recommended flow for this repo:

1. Change local code
2. Validate locally
3. Push to GitHub for review
4. Deploy to Cloudflare only after approval

## Notes
- Uploaded images are not stored persistently
- Background removal uses the server-side Remove.bg integration
- ID photo generation is composited client-side after cutout generation
- AI eraser currently uses in-browser OpenCV inpainting
