# Project Explanation: RunningHub App

## Overview
**RunningHub App** is a Serverless AI Image Editing application. It allows users to upload an image, provide a text prompt, and use the **Qwen** AI model (running on ComfyUI) to edit the image.

The app is built with **Next.js** for the frontend and hosted on **Cloudflare Pages**. It uses **Cloudflare Functions** as a secure proxy to communicate with a GPU-powered **ComfyUI** instance (likely hosted on RunPod) via a Cloudflare Tunnel.

## Architecture

```mermaid
graph TD
    User[User Browser]
    subgraph "Cloudflare Pages (Edge)"
        Frontend[Next.js Frontend]
        Proxy[Cloudflare Function Proxy]
        KV[KV Storage (TUNNEL_URL)]
    end
    subgraph "GPU Server (RunPod)"
        Tunnel[Cloudflare Tunnel]
        ComfyUI[ComfyUI Server]
        Qwen[Qwen AI Model]
    end

    User -->|Interacts| Frontend
    Frontend -->|API Calls (Upload/Prompt)| Proxy
    Proxy -->|Reads URL| KV
    Proxy -->|Forwards Request| Tunnel
    Tunnel -->|Reach| ComfyUI
    ComfyUI -->|Runs Workflow| Qwen
    ComfyUI -->|Returns Image| Proxy
    Proxy -->|Returns Image| Frontend
    Frontend -->|Displays| User
```

## Key Components

### 1. Frontend (User Interface)
*   **Framework**: Next.js 16 (App Router) + React 19.
*   **Styling**: TailwindCSS v4.
*   **Main Page** (`src/app/page.tsx`):
    *   Provides the UI for image upload, prompt entry, and setting generation parameters (Steps, CFG, Aspect Ratio).
    *   Handles the "Generate Edit" button click.
    *   Displays the result image or errors.
*   **Client Logic** (`src/lib/comfyClient.ts`):
    *   Orchestrates the communication with the backend.
    *   **Step 1**: Uploads the source image.
    *   **Step 2**: Modifies the ComfyUI workflow template (`workflow_template.json`) with the user's prompt and new image path.
    *   **Step 3**: Queues the generation prompt.
    *   **Step 4**: Polls for the result until completion.

### 2. Backend / Edge (The Proxy)
*   **Technology**: Cloudflare Pages Functions (`functions/api`).
*   **Why a Proxy?**: Browsers cannot connect directly to the ComfyUI server if it's behind a firewall or tunnel without CORS issues or exposing the raw tunnel URL publicly.
*   **Configuration** (`functions/api/config.ts`):
    *   Endpoints to **Get** and **Set** the `TUNNEL_URL`.
    *   This allows the backend to know where the active ComfyUI instance is (RunPod URLs can change).
*   **Proxy Logic** (`functions/api/proxy/[[path]].ts`):
    *   Catches all requests to `/api/proxy/*`.
    *   Retrieves the dynamic `TUNNEL_URL` from Cloudflare KV.
    *   Forwards the request (Upload, Prompt, History, View) to the ComfyUI server.
    *   Handles CORS so the browser is happy.

### 3. AI Engine (Infrastructure)
*   **ComfyUI**: The node-based AI generation backend.
*   **Workflow**: Specifically uses a **Qwen Image Edit** workflow.
*   **Scripts**: The `scripts/` folder contains utilities to:
    *   `verify_runpod_content.js`: Ensure the RunPod instance has the correct models.
    *   `runpod_downloader.py`: Automate downloading models to the server.

## Detailed Workflow (How it works)

1.  **Setup**: An admin sets the `TUNNEL_URL` (e.g., `https://my-tunnel.trycloudflare.com`) via the `/api/config` endpoint (captured in KV).
2.  **Upload**: User selects an image. `comfyClient.ts` POSTs it to `/api/proxy/upload/image`. The proxy forwards this to ComfyUI, which saves it.
3.  **Queue**: `comfyClient.ts` reads `workflow_template.json`, injects the prompt and the uploaded filename, and POSTs to `/api/proxy/prompt`.
4.  **Processing**: ComfyUI receives the JSON workflow and starts the GPU generation tasks.
5.  **Polling**: The frontend creates a loop, hitting `/api/proxy/history/{prompt_id}` every second to check status.
6.  **Retrieval**: Once finished, ComfyUI returns the output filename. The frontend requests `/api/proxy/view?filename=...`, bridging the image data back to the user.

## File Summary for Study

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Main application UI and state management. |
| `src/lib/comfyClient.ts` | The logical "driver" for the ComfyUI API interaction. |
| `functions/api/proxy/[[path]].ts` | The edge function that routes traffic to the hidden GPU server. |
| `functions/api/config.ts` | Manages the connection string (`TUNNEL_URL`) to the GPU server. |
| `scripts/*` | Python/JS scripts for managing the RunPod environment (non-app-runtime code). |
