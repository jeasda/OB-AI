# RunningHub App

A Next.js application integrated with Cloudflare Pages and ComfyUI for advanced AI image editing using the Qwen model.

## Features

- **AI Image Editing**: Seamless integration with ComfyUI workflows (Qwen Image Edit).
- **Serverless Backend**: Built on Cloudflare Pages with Cloudflare Functions for API handling.
- **Modern UI**: Styled with TailwindCSS.
- **Proxy Tunneling**: Secure connection to GPU providers (RunPod) via Cloudflare Tunnels/Workers.

## Prerequisites

- **Node.js**: Version 20+ recommended.
- **npm** (or pnpm/yarn).
- **ComfyUI Instance**: A running ComfyUI instance (e.g., on RunPod) with the Qwen Image Edit nodes and models installed.

## Setup & Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    # or
    pnpm install
    ```

2.  **Environment Configuration**:
    Create a `.env.local` file for local development:
    ```env
    # Direct URL to ComfyUI (Local or Public)
    COMFY_API_URL=http://127.0.0.1:8188
    ```
    
    *For Cloudflare deployment, ensure `TUNNEL_URL` is set in your KV namespace or Environment Variables.*

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

- `src/app`: Next.js App Router pages and API routes.
- `functions/api`: Cloudflare Pages Functions (Proxy logic).
- `scripts/`: Utility scripts for verifying backend state.
    - `check_models.js`: Checks available checkpoints on a local ComfyUI.
    - `verify_runpod_content.js`: Verifies Qwen-specific models on a remote RunPod instance.

## Deployment on Cloudflare Pages

This project is configured for Cloudflare Pages (`wrangler.toml`).

1.  **Build**:
    ```bash
    npm run build
    ```
2.  **Deploy**:
    ```bash
    npx wrangler pages deploy .
    ```

## Development Guidelines

See [AGENTS.md](./AGENTS.md) for detailed coding standards and workflow instructions.
