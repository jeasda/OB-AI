# Cloudflare Pages Settings - Qwen Image Edit

Paste the following into Cloudflare Pages project settings:

- Root directory: `frontend/services/qwen-image-edit`
- Build command: `npm install && npm run build`
- Build output directory: `dist`

Notes:
- Vite base is `/` for safe asset loading on nested routes.
- `dist/` is gitignored and should not be committed.
