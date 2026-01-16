# OB AI API (RunningHub-style: prompt -> compiler -> ComfyUI workflow -> RunPod)

## 0) Requirements
- Cloudflare Workers + Wrangler
- RunPod Serverless endpoint (ComfyUI worker)
- D1 + R2 bindings
- Secret: `RUNPOD_API_KEY`

## 1) Configure
1) Edit `wrangler.toml`
- `RUNPOD_ENDPOINT_ID`
- `database_id`
- bucket/database names if you changed them

2) Set secret:
```bash
npx wrangler secret put RUNPOD_API_KEY
```

3) (Optional) choose how we call RunPod:
- `RUNPOD_MODE="workflow"` (default): sends `{"input":{"workflow":{...}}}` (RunPod worker-comfyui)
- `RUNPOD_MODE="prompt"`: sends `{"input":{"prompt":"..."}}` (simple endpoints)

## 2) Deploy
```bash
npx wrangler deploy
```

## Frontend (Cloudflare Pages)
- Build: `npm run buildfrontend`
- Output: `dist`
- Route: `/services/qwen-image-edit`

## 3) Test (Windows PowerShell)
### A) JSON request (recommended)
```powershell
$body = @{
  prompt = "cinematic portrait of a thai girl, soft light, 85mm, bokeh"
  ratio  = "9:16"
  seed   = 123
  steps  = 20
  cfg    = 7
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://YOUR-WORKER.workers.dev/api/queue/create" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### B) Poll status
```powershell
Invoke-RestMethod `
  -Uri "https://YOUR-WORKER.workers.dev/api/queue/status/JOB_ID" `
  -Method GET
```

When status becomes `completed`, you will get `result_url` (served from R2 via the Worker).

## 4) Notes
- This repo includes a **small compiler**: `src/compiler/workflow.ts` that injects the prompt + ratio into a ComfyUI workflow template.
- Replace `src/workflows/flux_txt2img.json` with your own workflow exported from ComfyUI when you want different pipelines.
