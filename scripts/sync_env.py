"""Synchronize environment configuration files from env/ into the project structure.

Rules:
- Files directly in env/ (e.g. env/.env) are placed at the workspace root (./.env).
- Files in subdirectories of env/ (e.g. env/frontend/.env.local) are mirrored to the matching directory (frontend/.env.local).
"""

from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
ENV_DIR = ROOT / "env"


def sync_env():
    if not ENV_DIR.is_dir():
        print(f"[!] 'env' directory not found at: {ENV_DIR}")
        sys.exit(1)

    synced_count = 0
    for path in sorted(ENV_DIR.rglob("*")):
        if path.is_file():
            rel_path = path.relative_to(ENV_DIR)
            dest = ROOT / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)
            print(f"[OK] Synced: env/{rel_path.as_posix()} -> {rel_path.as_posix()}")
            synced_count += 1

    print(f"\n[OK] Successfully synchronized {synced_count} environment file(s).")


if __name__ == "__main__":
    sync_env()
