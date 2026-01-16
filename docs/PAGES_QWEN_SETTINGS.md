# Cloudflare Pages Settings - Qwen Image Edit

Paste the following into Cloudflare Pages project settings:

- Root directory: `.`
- Build command: `npm run buildfrontend`
- Build output directory: `dist`

Notes:
- Vite build uses `vite.config.js` in the repo root.
- The service page is emitted to `dist/services/qwen-image-edit/index.html`.
- `dist/` is gitignored and should not be committed.
