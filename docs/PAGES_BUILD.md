# Cloudflare Pages Build - Frontend

## Build Command
- `npm run buildfrontend`

## Output Directory
- `dist`

## Routes
- Qwen Image Edit: `/services/qwen-image-edit`

## Vite Settings
- `vite.config.js` uses base `./` to ensure assets resolve on nested routes.
- Build input points to `frontend/services/qwen-image-edit/index.html`.

## Notes
- `dist/` is gitignored.
- No `VITE_*` environment variables are used in the frontend.
