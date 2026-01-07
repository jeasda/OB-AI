
from huggingface_hub import list_repo_files

repo_id = "lightx2v/Qwen-Image-Lightning"
print(f"Listing files in: {repo_id}")

try:
    files = list_repo_files(repo_id=repo_id)
    for f in files:
        print(f" - {f}")
except Exception as e:
    print(f"Error: {e}")
