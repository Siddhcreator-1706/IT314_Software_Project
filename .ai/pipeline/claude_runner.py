"""Claude Code CLI Integration Runner.

Executes Claude Code non-interactively using the developer's existing
Claude Pro / Team authentication via `claude -p`.
Includes dry-run simulation for safe pipeline validation.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("drch.ai.claude")


def detect_claude_cli() -> Dict[str, Any]:
    """Detect if the Claude Code CLI is installed and check its version."""
    cli_path = shutil.which("claude")
    if not cli_path:
        return {"installed": False, "path": None, "version": None}

    version = None
    try:
        proc = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
        if proc.returncode == 0:
            version = proc.stdout.strip()
    except Exception:
        version = "detected (version check timed out)"

    return {
        "installed": True,
        "path": cli_path,
        "version": version or "unknown",
    }


def invoke_claude(
    prompt: str,
    config: Dict[str, Any],
    label: str,
    cwd: Path,
    dry_run: bool = False,
    timeout_seconds: int = 300,
) -> Optional[str]:
    """Invoke Claude Code CLI with the specified prompt and configuration.

    If dry_run is True, returns a structured simulated response without invoking the CLI.
    """
    if dry_run:
        print(f"  [DRY RUN] Simulating Claude Code execution for: {label}")
        if "plan" in label.lower():
            return (
                f"### [Simulated Plan for: {label}]\n\n"
                "1. Scope: Identified affected files in backend and frontend.\n"
                "2. Constraints: Verified Neon PostgreSQL + PostGIS compliance.\n"
                "3. Implementation steps:\n"
                "   - Update endpoint logic in `backend/app/routers/`\n"
                "   - Add unit test in `backend/tests/`\n"
                "4. Testing: Run `python -m pytest backend/tests/test_units.py`."
            )
        elif "implementation" in label.lower():
            return (
                f"### [Simulated Implementation for: {label}]\n\n"
                "Simulated code changes applied. Zero files were modified during dry-run."
            )
        elif "review" in label.lower():
            return (
                f"### [Simulated Code Review for: {label}]\n\n"
                "- [COMPLIANT] Concurrency locking rules adhered to.\n"
                "- [COMPLIANT] Zero Supabase dependencies introduced.\n"
                "- [SUGGESTION] Ensure complete test coverage before PR."
            )
        return f"[Simulated response for: {label}]"

    cli_info = detect_claude_cli()
    if not cli_info["installed"]:
        print("❌ Error: Claude Code CLI (`claude`) is not installed or not in PATH.")
        print("   Install via: npm install -g @anthropic-ai/claude-code")
        print("   Then authenticate using your Claude Pro account: claude")
        return None

    cmd: List[str] = list(config.get("claude_command", ["claude", "-p"]))
    if config.get("model"):
        cmd += ["--model", str(config["model"])]

    perm_mode = config.get("permission_mode", "default")
    cmd += ["--permission-mode", perm_mode, prompt]

    print(f"  ⏳ Running Claude Code CLI: {label}...")
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=timeout_seconds,
        )
        if proc.returncode != 0:
            err = proc.stderr.strip() or proc.stdout.strip()
            print(f"  ❌ Claude Code CLI exited with code {proc.returncode}")
            if err:
                print(f"  Log preview: {err[-1000:]}")
            return None

        return proc.stdout.strip()
    except subprocess.TimeoutExpired:
        print(f"  ❌ Claude Code CLI timed out after {timeout_seconds}s")
        return None
    except Exception as e:
        print(f"  ❌ Error executing Claude Code CLI: {e}")
        return None

