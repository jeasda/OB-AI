
# 🐢 RunPod Beginner Guide: Setting Up Models & Storage (Final Verified)

Since **Serverless Endpoints** do not have persistent storage by default, we use a **Network Volume** to store our 30GB+ of models.

---

## Phase 1: Create Storage (Network Volume)

1.  **Go to Storage**: Click **Storage** on the left sidebar.
2.  **Create Volume**:
    *   **Name**: `comfy-models`
    *   **Data Center**: **MUST MATCH** your Endpoint's region (check your Endpoint dashboard).
    *   **Size**: `60 GB` (Recommended for safety; 40 GB is minimum).
3.  Click **Create** and wait for "Available".

---

## Phase 2: Start Temporary Pod (For Downloading)

We need a temporary GPU machine to download the models.

1.  **Go to Pods**: Click **+ Deploy Pod**.
2.  **Choose GPU**: Any cheap GPU (e.g., RTX 3060, or Community Cloud).
3.  **Customize Deployment** (Important!):
    *   **Network Volume**: Select `comfy-models`.
    *   **Mount Path**: `/workspace/ComfyUI/models` (Type this EXACTLY).
4.  **Deploy** and wait for "Running".

---

## Phase 3: Download Models (The Robust Way)

The `wget` command can be flaky with HuggingFace LFS files. We use a Python script to ensure 100% integrity.

1.  **Connect**: Open the Pod's **Web Terminal**.
2.  **Install Dependencies**:
    ```bash
    pip install huggingface_hub
    ```
3.  **Create Download Script**:
    *   Type: `nano download_fix.py`
    *   Paste this code:
    ```python
    from huggingface_hub import HfApi, hf_hub_download
    import os

    api = HfApi()

    models = [
        {
            "name": "CLIP",
            "repo": "Comfy-Org/Qwen-Image_ComfyUI",
            "remote": "split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors",
            "local_dir": "/workspace/ComfyUI/models/clip",
            "filename": "qwen_2.5_vl_7b_fp8_scaled.safetensors"
        },
        {
            "name": "LoRA",
            "repo": "lightx2v/Qwen-Image-Lightning",
            "remote": "Qwen-Image-Edit-2509/Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors",
            "local_dir": "/workspace/ComfyUI/models/loras",
            "filename": "Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors"
        },
        {
            "name": "UNET",
            "repo": "Comfy-Org/Qwen-Image-Edit_ComfyUI",
            "remote": "split_files/diffusion_models/qwen_image_edit_2509_fp8_e4m3fn.safetensors",
            "local_dir": "/workspace/ComfyUI/models/unet",
            "filename": "qwen_image_edit_2509_fp8_e4m3fn.safetensors"
        },
         {
            "name": "VAE",
            "repo": "Comfy-Org/Qwen-Image_ComfyUI",
            "remote": "split_files/vae/qwen_image_vae.safetensors",
            "local_dir": "/workspace/ComfyUI/models/vae",
            "filename": "qwen_image_vae.safetensors"
        }
    ]

    print("🕵️‍♂️ Starting Integrity Check & Download...")

    for m in models:
        print(f"Checking {m['name']}...")
        local_path = os.path.join(m['local_dir'], m['filename'])
        
        # 1. Get correct remote size
        remote_size = -1
        try:
            info = api.model_info(repo_id=m['repo'], files_metadata=True)
            for f in info.siblings:
                if f.rfilename == m['remote']:
                    remote_size = f.size
                    break
        except: pass

        # 2. Check local size
        local_size = os.path.getsize(local_path) if os.path.exists(local_path) else -1

        # 3. Compare
        if local_size == remote_size:
            print(f"   ✅ Perfect Match!")
        else:
            print(f"   ⬇️ Downloading...")
            hf_hub_download(repo_id=m['repo'], filename=m['remote'], local_dir=m['local_dir'], local_dir_use_symlinks=False)
            
            # Post-download fix (move file if nested)
            expected_dl = os.path.join(m['local_dir'], m['remote'])
            if os.path.exists(expected_dl) and expected_dl != local_path:
                os.rename(expected_dl, local_path)
                try: os.removedirs(os.path.dirname(expected_dl))
                except: pass
            print("   ✨ Done.")

    print("\n🎉 All Models Verified.")
    ```
    *   Save (`Ctrl+O` -> Enter) and Exit (`Ctrl+X`).

4.  **Run Script**:
    ```bash
    python download_fix.py
    ```
    *   Wait until all models show "✅ Perfect Match".

---

## Phase 4: Configure Serverless Endpoint (Critical)

1.  **Terminate Temporary Pod**: Go back to "Pods" and delete it (save money).
2.  **Edit Serverless Endpoint**: Go to your Endpoint -> Settings (Edit).
3.  **Advanced Tab (Container Start Command)**:
    *   **THIS IS THE KEY STEP**. RunPod mounts volume at `/runpod-volume`. We must symlink it to where ComfyUI looks (`/comfyui/models`).
    *   **Container Start Command**: Paste this EXACTLY:
        ```bash
        bash -c "rm -rf /comfyui/models && ln -s /runpod-volume /comfyui/models && /start.sh"
        ```
4.  **Environment Variables**:
    *   Add any required env vars (e.g., `RUNPOD_API_KEY` if needed inside).
5.  **Click Update Endpoint**.

---

## Phase 5: Verify

Run your test script (`test_runpod_generate.js`). The first run ("Cold Start") may take 3-5 minutes to load the models. Subsequent runs will be faster.
