# OB Codex

## RunningHub-like Architecture (Proposed)

### Overview
- Edge API on Cloudflare Worker handles create/status/result.
- Orchestrator submits jobs to RunPod, polls status, stores outputs.
- D1 stores job metadata and state; R2 stores inputs/outputs.
- Optional proxy path to ComfyUI via tunnel for admin/debug.

### Mental Diagram
```text
User/Client
  -> Cloudflare Worker API (/api/queue/create, /api/queue/status/:id, /api/result/:key)
      -> D1 (job table, status, metadata)
      -> Orchestrator (Durable Object or Queue consumer)
          -> RunPod API (submit, status)
          -> R2 (store images)
      <- Worker returns status/result URL
  -> Optional /api/proxy/* -> tunnel -> ComfyUI (admin/debug only)
```

### API Flow
1) POST /api/queue/create
   - Validate input
   - Compile workflow (template + prompt + ratio + params)
   - Create job in D1
   - Enqueue job ID
   - Return job_id immediately
2) Orchestrator
   - Submit to RunPod
   - Poll status with backoff
   - Store output in R2
   - Update D1 with result URL and status
3) GET /api/queue/status/:id
   - Read status from D1
4) GET /api/result/:key
   - Serve R2 object or redirect to CDN

### D1 Data Model (jobs)
- id, status, created_at, updated_at
- prompt, model, ratio, seed, steps, cfg
- runpod_id, result_key, error
- input_key (optional for image editing)

### Production Considerations
- Idempotency on create (client request_id)
- Input validation and size limits
- Rate limiting per key or origin
- Retries with capped backoff; cancel stale jobs
- Centralized logging and basic metrics

## Error Handling and Logging (Baseline)

### Response Shape
- Success: `{ ok: true, request_id, ... }`
- Error: `{ ok: false, error, request_id, ... }`
- Include `request_id` on all responses for traceability.

### Request ID
- Use `x-request-id` if provided.
- Fallback to `cf-ray` or `crypto.randomUUID()`.

### Logging Events
- Log JSON lines with: `level`, `event`, `ts`, and contextual fields (job_id, runpod_id, path).
- Log at key points: request received, submit, status update, completion, failure.

## Typecheck Hardening Tasks (Requested)
- Fix import path for queue route in `src/index.ts` to `./routes/queue.create`.
- Add `src/env.d.ts` with `Env` interface: `DB`, `R2_RESULTS`, `R2_PREFIX`, `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT`, `RUNPOD_MODE?`, `ENVIRONMENT?`.
- Replace all `Env` imports from `../index` to `../env`.
- Export `getRunPodStatus`, `extractBase64Png`, `extractOutputImageUrl` from `src/services/runpod.service.ts` (stubs OK).
- Apply minimal casts to resolve strict typing; goal is `npm run typecheck` passing.
- Normalize `imageUrl` naming (avoid `image_url`).

## Typecheck Fixes (Latest)
- Added stub export `runpodGetStatus` in `src/services/runpod.ts` to satisfy `src/services/poll.service.ts` import.

## Worker Phase Setup
- Entrypoint is `src/index.ts` with default export `{ fetch(...) }` using `Env` type-only import.
- `wrangler.toml` sets `name`, `main`, and `compatibility_date`, plus placeholders for D1 `DB` and R2 `R2_RESULTS`.
- `RUNPOD_ENDPOINT_ID` is configured via `[vars]` and should be set per environment.

### Local Dev Notes
- `wrangler.toml` uses valid placeholder names for `database_name` and `bucket_name` to allow `wrangler dev --local` to start.
- RunPod calls are stubbed when `RUNPOD_ENDPOINT_ID` is `replace-me` or `ENVIRONMENT` is `local`, returning a tiny PNG base64 for end-to-end local flow.
- Local health and queue create endpoints validated against `wrangler dev --local`.

## Task Log (2026-01-15)
- Changed: No code changes; ran local validation commands.
- Why: To confirm typecheck passes and the mocked end-to-end workflow is functional.
- Verify: `npm run typecheck`; `npx wrangler dev --local` then `POST http://127.0.0.1:8787/api/queue/create` with `{"prompt":"test prompt"}` and expect `200` plus a stubbed `job`.


## Task Log (2026-01-15 - Production Readiness)
- Changed: Added production env validation, mock-mode guard, and debug-route blocks in `src/index.ts`.
- Changed: Updated RunPod services to require `RUNPOD_ENDPOINT` and block mock responses in production.
- Changed: Finalized `wrangler.toml` with production environment separation and added `DEPLOY.md` checklist.
- Why: Ensure safe production configuration, enforce required env vars, and prevent debug/mock behavior in production.
- Verify: `npm run typecheck`; `npx wrangler deploy --dry-run --env production`.

## Incident RunPod API Request Failure (400 Bad Request)

### A) Context
- What the system was trying to do: UNKNOWN / NOT LOGGED YET

### B) Outgoing Request (NO OMISSIONS)
- Full endpoint URL: UNKNOWN / NOT LOGGED YET
- HTTP method: UNKNOWN / NOT LOGGED YET
- All headers: UNKNOWN / NOT LOGGED YET
- Full request body BEFORE stringify: UNKNOWN / NOT LOGGED YET
- Exact request body AFTER stringify: UNKNOWN / NOT LOGGED YET

### C) Incoming Response
- HTTP status code: 400
- Full response headers: UNKNOWN / NOT LOGGED YET
- Full response body (raw): UNKNOWN / NOT LOGGED YET

### D) Validation Checks
- Whether API key exists and is correct: UNKNOWN / NOT LOGGED YET
- Whether Content-Type matches RunPod requirements: UNKNOWN / NOT LOGGED YET
- Whether payload schema matches RunPod docs: UNKNOWN / NOT LOGGED YET
- Whether the same payload was tested via curl/Postman: UNKNOWN / NOT LOGGED YET

### E) Initial Observations (NOT conclusions)
- Possible causes: UNKNOWN / NOT LOGGED YET
- What has already been ruled out: UNKNOWN / NOT LOGGED YET

### F) Open Questions
- Exact request payload values at time of failure: UNKNOWN / NOT LOGGED YET
- Exact response payload from RunPod: UNKNOWN / NOT LOGGED YET
- Whether request headers included required auth/content type: UNKNOWN / NOT LOGGED YET

## Task Log (2026-01-15 - RunPod API Key Handling)
- Changed: RunPod request headers now read the API key from `process.env.RUNPOD_API_KEY` and throw `RUNPOD_API_KEY is not set` when missing.
- Changed: Added RunPod request logging with `Authorization` explicitly redacted from headers.
- Changed: Removed hardcoded fallback API key value in `scripts/test_runpod_direct.js`.
- Why: Ensure the API key is only sourced from environment variables and never logged or exposed.
- Evidence: RunPod request logging now uses redacted headers; no code logs or prints the API key value.

## Task Log (2026-01-15 - RunPod Request Security)
- Changed: `src/services/runpod.service.ts`, `src/services/queue.service.ts`, and `scripts/test_runpod_direct.js`.
- Why: Enforce API key usage exclusively from `process.env.RUNPOD_API_KEY` with a hard error when missing.
- Evidence: Request logs redact `Authorization` and never print the API key; actual requests still include the real `Authorization` header internally.

## Task Log (2026-01-15 - RunPod Status + Artifact Retrieval)
- Changed: `src/services/r2.service.ts` added `putPngBytes` for non-base64 outputs.
- Changed: `src/routes/queue.ts` now fetches output image URLs when base64 output is absent, then stores bytes in R2.
- Changed: `src/services/runpod.service.ts` now submits the full input payload (e.g., `workflow`) instead of only prompt/ratio/model.
- Why: Enable the status polling step to retrieve output artifacts regardless of whether RunPod returns base64 or image URLs and fix missing `workflow` input.
- Evidence: `POST /run` with prompt-only input returns `FAILED` with `"Missing 'workflow' parameter"`. `POST /run` with `workflow` accepts job and status polling works; job failed with `"No checkpoint models appear to be available"` (model availability issue on RunPod).
- Not achieved yet: A completed job and output image retrieval, blocked by missing checkpoint model on the RunPod worker.

## Serverless Migration  Qwen Image Edit Reference Spec

### Verified model path(s)
- `/workspace/ComfyUI/models` (Network Volume mount path used on the reference Pod). Source: `docs/RUNPOD_SETUP.md`
- `/runpod-volume` (Serverless volume mount). Source: `docs/RUNPOD_SETUP.md`
- `/comfyui/models` (ComfyUI expected path; symlink to `/runpod-volume`). Source: `docs/RUNPOD_SETUP.md`

### Verified model filename(s)
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` (CLIP). Source: `docs/RUNPOD_SETUP.md`, `scripts/runpod_downloader.py`, `src/lib/workflow_template.json`
- `qwen_image_vae.safetensors` (VAE). Source: `docs/RUNPOD_SETUP.md`, `scripts/runpod_downloader.py`, `src/lib/workflow_template.json`
- `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` (LoRA). Source: `docs/RUNPOD_SETUP.md`, `scripts/runpod_downloader.py`, `src/lib/workflow_template.json`
- `qwen_image_edit_2509_fp8_e4m3fn.safetensors` (UNET). Source: `docs/RUNPOD_SETUP.md`, `scripts/runpod_downloader.py`, `src/lib/workflow_template.json`

### Verified workflow JSON reference
- `src/lib/workflow_template.json` (ComfyUI graph used by tests and template injection). Source: `scripts/test_runpod_generate.js`, `docs/PROJECT_EXPLANATION.md`
- `src/lib/workflow_api_converted.json` (API-format conversion of the same workflow). Source: `scripts/convert_graph_to_api.js`
- `src/lib/workflow.ts` (TypeScript copy of the workflow template). Source: `src/lib/workflow.ts`

### Expected input schema and output format
- Input schema (RunPod handler for ComfyUI):
  - `input.workflow`: full ComfyUI workflow graph JSON (required). Source: `scripts/test_runpod_generate.js`, RunPod failure `"Missing 'workflow' parameter"`.
  - `input.images`: optional array of `{ name: string, image: base64 }` to satisfy `LoadImage` nodes. Source: `scripts/test_runpod_generate.js`.
- Output format (handled by worker code):
  - Output may include a base64 PNG (`output.image_base64` or `output.image`) or image URL (`output.url`, `output.image_url`, `output.result_url`, or `output.images[0]`). Source: `src/services/runpod.service.ts`, `src/routes/queue.ts`.

### Notes on why this setup works logically
- The workflow explicitly references Qwen Image Edit model files by exact filename (UNET/CLIP/VAE/LoRA), so the mounted model paths must expose those filenames under ComfyUI’s expected model directories.
- Serverless setup symlinks `/comfyui/models` to `/runpod-volume` to align ComfyUI’s default lookup with the Network Volume contents, keeping the workflow filenames valid without modifying the workflow graph.

## Serverless Migration  Docker Image (Qwen Image Edit)
- Dockerfile path: `Dockerfile`
- Model files baked into the image:
  - `qwen_2.5_vl_7b_fp8_scaled.safetensors` (CLIP)
  - `qwen_image_vae.safetensors` (VAE)
  - `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` (LoRA)
  - `qwen_image_edit_2509_fp8_e4m3fn.safetensors` (UNET)
- Model directory structure inside the container:
  - `/workspace/ComfyUI/models/clip/qwen_2.5_vl_7b_fp8_scaled.safetensors`
  - `/workspace/ComfyUI/models/vae/qwen_image_vae.safetensors`
  - `/workspace/ComfyUI/models/loras/Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors`
  - `/workspace/ComfyUI/models/unet/qwen_image_edit_2509_fp8_e4m3fn.safetensors`
- Symlink: `/comfyui/models -> /workspace/ComfyUI/models` to match ComfyUI lookup paths.

## Task Log (2026-01-15 - Serverless Deploy Attempt)
- Changed: No code changes in this step.
- Blocker: `docker` is not available in the current environment, so image build/push cannot proceed.
- Blocker: No container registry target or credentials are present in-repo to push the image for RunPod Serverless.
- Blocker: RunPod endpoint creation requires external credentials and tooling not available in this environment.
- Status: Build/push, endpoint creation, and live job test are not executed in this environment.

## Task Log (2026-01-15 - Qwen Image Edit Service Page)
- New route: `/services/qwen-image-edit` static page under `frontend/services/qwen-image-edit/index.html` with JS modules.
- Prompt mapping: `frontend/services/qwen-image-edit/lib/prompt.js` compiles Thai selections into an English edit prompt with identity preservation and quality baselines.
- Credit simulation (test mode): localStorage credits with simulated purchase buttons in `frontend/services/qwen-image-edit/components/PaymentModal.js`.
- Manual test: open `/services/qwen-image-edit`, upload image, pick options/ratio, submit, approve payment simulation if needed, wait for result, download no-watermark image.
## 2026-01-16 00:48 Session Summary

### Summary of changes
- Implemented RunPod webhook idempotency and ordering guards, plus webhook timing metrics.
- Removed live polling fallback; added manual recovery poller script.
- Enforced WORKFLOW_CONTRACT_V1 validation and added contract validation script.
- Added structured logging enhancements, metrics storage, and DR documentation.

### Files created/modified
- Created: src/lib/logger.ts, src/lib/workflow_contract.ts, src/services/job_timestamps.service.ts, src/services/metrics.service.ts, src/services/webhook_events.service.ts
- Modified: src/routes/queue.ts, src/routes/runpod.webhook.ts, src/services/runpod.service.ts, src/services/jobs.service.ts, src/services/r2.service.ts, src/utils/log.ts, src/env.ts, env.d.ts
- Created: scripts/runpod/recover_poll.mjs, scripts/contracts/validate_workflow_contract.mjs, scripts/dr/d1_backup_restore.mjs
- Updated docs: docs/STABILIZE_PHASE2_CHECKLIST.md, docs/LOGGING_SCHEMA_V1.md, docs/RUNPOD_WEBHOOKS.md, docs/DEPLOY_RUNPOD_WORKER.md, docs/WORKFLOW_CONTRACT_V1.md, docs/WORKFLOW_CONTRACT_ENFORCEMENT.md, docs/D1_DISASTER_RECOVERY.md, docs/RUNPOD_DEBUG_PLAYBOOK.md, docs/GOLDEN_TESTS_V1.md, docs/WORKFLOW_CHANGELOG.md, WORKFLOW_CHANGELOG.md

### Commands executed
- npm run typecheck
- rg --files -g 'OB_Codex.md' -g 'OB_Coex.md'
- Get-Date -Format 'yyyy-MM-dd HH:mm'

### Verification steps
- TypeScript typecheck passed (npm run typecheck)

### Remaining risks
- Webhook security and RunPod event payload assumptions should be validated against live staging payloads.
- D1 schema migrations (ALTERs) require deployment coordination.
## 2026-01-16 00:50 Session Summary

### Summary of changes
- Updated D1 schema file to include webhook idempotency, timestamps, and metrics tables.

### Files created/modified
- Modified: schema.sql

### Commands executed
- Get-Date -Format 'yyyy-MM-dd HH:mm'
- Set-Content -Path 'C:\Anti_OB\runninghub-app\schema.sql'

### Verification steps
- Not run (schema change only)

### Remaining risks
- Ensure D1 migrations align with schema.sql changes before deployment
## 2026-01-16 00:52 Session Summary

### Summary of changes
- Staged and committed Phase 2 hardening artifacts and documentation.

### Files created/modified
- Staged and committed the Phase 2 hardening files listed in prior entries

### Commands executed
- git status -sb
- git diff --stat
- git add -- schema.sql env.d.ts src/env.ts src/lib/logger.ts src/lib/workflow_contract.ts src/utils/log.ts src/routes/queue.ts src/routes/runpod.webhook.ts src/services/jobs.service.ts src/services/runpod.service.ts src/services/r2.service.ts src/services/job_timestamps.service.ts src/services/metrics.service.ts src/services/webhook_events.service.ts scripts/runpod/recover_poll.mjs scripts/runpod/smoke_run.mjs scripts/contracts/validate_workflow_contract.mjs scripts/dr/d1_backup_restore.mjs scripts/deploy/runpod_pipeline.mjs scripts/golden-tests/run.mjs scripts/golden-tests/README.md docs/STABILIZE_PHASE2_CHECKLIST.md docs/LOGGING_SCHEMA_V1.md docs/RUNPOD_WEBHOOKS.md docs/DEPLOY_RUNPOD_WORKER.md docs/WORKFLOW_CONTRACT_V1.md docs/WORKFLOW_CONTRACT_ENFORCEMENT.md docs/D1_DISASTER_RECOVERY.md docs/RUNPOD_DEBUG_PLAYBOOK.md docs/GOLDEN_TESTS_V1.md docs/WORKFLOW_CHANGELOG.md WORKFLOW_CHANGELOG.md OB_Codex.md OB_Coex.md
- git commit -m "feat(phase2): harden runpod webhook and contracts"

### Verification steps
- Not run during this final staging/commit step

### Remaining risks
- Unstaged and uncommitted changes remain in the repo and should be reviewed separately
