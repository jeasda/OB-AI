# Golden Prompt Tests (Qwen Image Edit)

## Purpose
- Run deterministic, repeatable tests for the Qwen Image Edit workflow.
- Detect identity drift, workflow breakage, and API contract regressions.
- Produce machine-readable and human-readable reports for audits.

## Prepare Input Image
1. Place a representative face photo at `scripts/golden-tests/input.png`.
2. Use a clear, front-facing portrait for best identity checks.

## Run Locally
1. Start the local Worker:
   ```bash
   npx wrangler dev --local
   ```
2. In another terminal, run golden tests:
   ```bash
   node scripts/golden-tests/run.mjs
   ```

## Run Against Production
```bash
GT_BASE_URL="https://YOUR-WORKER.workers.dev" node scripts/golden-tests/run.mjs
```

## Override API Paths
By default, the script calls:
- Create: `/api/qwen-image-edit/create`
- Status: `/api/qwen-image-edit/status`
- Download: `/api/qwen-image-edit/download`

If your environment uses the queue endpoints, override with:
```bash
GT_CREATE_PATH="/api/queue/create" \
GT_STATUS_PATH="/api/queue/status" \
GT_DOWNLOAD_PATH="/api/result" \
node scripts/golden-tests/run.mjs
```

## Environment Variables
- `GT_BASE_URL` (default: `http://127.0.0.1:8788`)
- `GT_CREATE_PATH` (default: `/api/qwen-image-edit/create`)
- `GT_STATUS_PATH` (default: `/api/qwen-image-edit/status`)
- `GT_DOWNLOAD_PATH` (default: `/api/qwen-image-edit/download`)
- `GT_IMAGE` (default: `scripts/golden-tests/input.png`)
- `GT_TIMEOUT_MS` (default: `720000`)
- `GT_POLL_INTERVAL_MS` (default: `3000`)
- `GT_MAX_LATENCY_MS` (default: `360000`)
- `GT_ENV` (default: `staging`)

## Output
- Each run writes to `scripts/golden-tests/out/<run-id>/`.
- `report.json` contains full structured results.
- `report.md` provides a readable summary table.
- `reports/latest.json` always points to the latest run.
