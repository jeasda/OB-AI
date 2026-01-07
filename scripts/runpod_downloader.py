
try:
    import huggingface_hub
except ImportError:
    print("Installing huggingface_hub...")
    import subprocess
    subprocess.check_call(["pip", "install", "huggingface_hub"])
    from huggingface_hub import list_repo_files, hf_hub_download

from huggingface_hub import list_repo_files, hf_hub_download
import os

repo_id = "Comfy-Org/Qwen-Image-Edit_ComfyUI"
print(f"🔍 Scanning repository: {repo_id}...")

# Get all files in repo
all_files = list_repo_files(repo_id=repo_id)

# Define what we are looking for
targets = {
    "CLIP": {
        "filename": "qwen_2.5_vl_7b_fp8_scaled.safetensors", 
        "dest": "clip" 
    },
    "VAE": {
        "filename": "qwen_image_vae.safetensors", 
        "dest": "vae" 
    },
    "LoRA": {
        "filename": "Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors", 
        "dest": "loras" 
    },
    # UNET is already verified but script can check it too
    "UNET": {
        "filename": "qwen_image_edit_2509_fp8_e4m3fn.safetensors",
        "dest": "unet"
    }
}

base_dir = "/workspace/ComfyUI/models"

for key, info in targets.items():
    target_file = info["filename"]
    dest_folder = os.path.join(base_dir, info["dest"])
    
    # 1. Find exact path in repo
    remote_path = next((f for f in all_files if f.endswith(target_file)), None)
    
    if not remote_path:
        print(f"❌ Could not find {key} ({target_file}) in repository!")
        continue
        
    print(f"✅ Found {key}: {remote_path}")
    
    # 2. Check if already exists (skip big downloads if possible, verifying size is better but simple check first)
    local_path = os.path.join(dest_folder, target_file)
    if os.path.exists(local_path):
        print(f"   ⏩ File exists at {local_path}, skipping download.")
        continue

    # 3. Download
    print(f"   ⬇️ Downloading to {dest_folder}...")
    try:
        hf_hub_download(
            repo_id=repo_id, 
            filename=remote_path, 
            local_dir=dest_folder,
            local_dir_use_symlinks=False
        )
        print("   ✨ Download Complete!")
    except Exception as e:
        print(f"   ❌ Failed to download: {e}")

print("\n🎉 All operations completed.")
