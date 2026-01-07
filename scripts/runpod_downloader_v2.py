
try:
    from huggingface_hub import list_repo_files, hf_hub_download
except ImportError:
    import subprocess
    subprocess.check_call(["pip", "install", "huggingface_hub"])
    from huggingface_hub import list_repo_files, hf_hub_download
import os

base_dir = "/workspace/ComfyUI/models"

# 1. CLIP & VAE (From Qwen-Image_ComfyUI - Notice NO '-Edit')
repo_base = "Comfy-Org/Qwen-Image_ComfyUI"
targets_base = [
    {"filename": "qwen_2.5_vl_7b_fp8_scaled.safetensors", "dest": "clip"},
    {"filename": "qwen_image_vae.safetensors", "dest": "vae"}
]

# 2. LoRA (From lightx2v)
repo_lora = "lightx2v/Qwen-Image-Lightning"
targets_lora = [
    {"filename": "Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors", "dest": "loras"}
]

def download_from_repo(repo_id, targets):
    print(f"\n🔍 Scanning Repo: {repo_id}...")
    try:
        all_files = list_repo_files(repo_id=repo_id)
        for target in targets:
            info = target
            print(f"👉 Looking for: {info['filename']}")
            
            # Find remote path
            remote_path = next((f for f in all_files if f.endswith(info["filename"])), None)
            
            if remote_path:
                print(f"   ✅ Found at: {remote_path}")
                dest_path = os.path.join(base_dir, info["dest"])
                print(f"   ⬇️ Downloading to {dest_path}...")
                hf_hub_download(repo_id=repo_id, filename=remote_path, local_dir=dest_path)
                print("   ✨ Done!")
            else:
                print(f"   ❌ NOT FOUND in this repo: {info['filename']}")
    except Exception as e:
        print(f"   ❌ Error scanning/downloading from {repo_id}: {e}")

# Execute
download_from_repo(repo_base, targets_base)
download_from_repo(repo_lora, targets_lora)

print("\n🎉 Update Complete! Please check for any error messages above.")
