"""DRCH Validation and Test Runner.

Executes automated checks (ruff, pytest, frontend type checks) with safety filtering,
captures logs, and generates a structured verification report at
`.ai/reports/<task_id>_validation.md`.
"""

from __future__ import annotations

import logging
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("drch.ai.validator")

# Commands strictly forbidden in the automated validation runner
DISALLOWED_PATTERNS = [
    "commit",
    "push",
    "reset",
    "clean -f",
    "rebase",
    "merge",
    "drop table",
    "truncate",
    "rm -rf",
    "sudo",
]


def is_safe_command(cmd: str) -> bool:
    """Ensure command contains no mutating or destructive operations."""
    lowered = cmd.lower()
    return not any(disallowed in lowered for disallowed in DISALLOWED_PATTERNS)


def discover_default_checks(repo_root: Path) -> List[Dict[str, str]]:
    """Discover available test and lint commands based on repository contents."""
    checks: List[Dict[str, str]] = []

    # Backend checks
    backend_dir = repo_root / "backend"
    if backend_dir.exists():
        checks.append({
            "name": "Backend Ruff Linter",
            "command": "python -m ruff check backend/",
            "category": "lint",
        })
        # Check if tests directory exists
        if (backend_dir / "tests").exists() or (repo_root / "tests").exists():
            checks.append({
                "name": "Backend Unit Tests",
                "command": "python -m pytest backend/tests/ -q --disable-warnings",
                "category": "test",
            })

    # Frontend checks
    frontend_dir = repo_root / "frontend"
    if frontend_dir.exists() and (frontend_dir / "package.json").exists():
        checks.append({
            "name": "Frontend Lint",
            "command": "npm run lint --prefix frontend",
            "category": "lint",
        })

    return checks


def execute_validation_checks(
    task_id: str,
    repo_root: Path,
    reports_dir: Path,
    custom_checks: Optional[List[Dict[str, str]]] = None,
    dry_run: bool = False,
    prompt_approval: bool = False,
) -> Tuple[bool, Path]:
    """Run validation checks and write results to `.ai/reports/<task_id>_validation.md`."""
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_file = reports_dir / f"{task_id}_validation.md"

    checks_to_run = custom_checks or discover_default_checks(repo_root)

    print(f"\n🧪 Running Validation Suite for {task_id} ({len(checks_to_run)} checks)...")

    results: List[Dict[str, Any]] = []
    all_passed = True

    for item in checks_to_run:
        name = item["name"]
        cmd = item["command"]

        if not is_safe_command(cmd):
            print(f"  ⚠️ Skipping unsafe validation command: {cmd}")
            results.append({
                "name": name,
                "command": cmd,
                "status": "SKIPPED_UNSAFE",
                "returncode": -1,
                "output": "Command blocked by security filter.",
                "duration_seconds": 0.0,
            })
            continue

        if prompt_approval:
            confirm = input(f"  Execute check '{name}' (`{cmd}`)? [Y/n]: ").strip().lower()
            if confirm and confirm != "y":
                print(f"  ⏭️ Skipped '{name}' by user.")
                results.append({
                    "name": name,
                    "command": cmd,
                    "status": "SKIPPED_BY_USER",
                    "returncode": 0,
                    "output": "User skipped check.",
                    "duration_seconds": 0.0,
                })
                continue

        if dry_run:
            print(f"  [DRY RUN] Simulating check: {name} (`{cmd}`)")
            results.append({
                "name": name,
                "command": cmd,
                "status": "PASSED (SIMULATED)",
                "returncode": 0,
                "output": "[Simulated output: 0 errors detected]",
                "duration_seconds": 0.01,
            })
            continue

        print(f"  ⏳ Running: {name}...")
        start_time = time.time()
        try:
            proc = subprocess.run(
                cmd,
                shell=True,
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=180,
            )
            duration = round(time.time() - start_time, 2)
            passed = proc.returncode == 0
            if not passed:
                all_passed = False

            output = (proc.stdout + "\n" + proc.stderr).strip()
            status_str = "PASSED" if passed else "FAILED"
            icon = "✅" if passed else "❌"
            print(f"  {icon} {name}: {status_str} (code {proc.returncode}, {duration}s)")

            results.append({
                "name": name,
                "command": cmd,
                "status": status_str,
                "returncode": proc.returncode,
                "output": output[:3000],
                "duration_seconds": duration,
            })
        except subprocess.TimeoutExpired:
            all_passed = False
            print(f"  ❌ {name}: TIMED OUT (>180s)")
            results.append({
                "name": name,
                "command": cmd,
                "status": "TIMEOUT",
                "returncode": -1,
                "output": "Command execution timed out after 180 seconds.",
                "duration_seconds": 180.0,
            })
        except Exception as e:
            all_passed = False
            print(f"  ❌ {name}: ERROR ({e})")
            results.append({
                "name": name,
                "command": cmd,
                "status": "ERROR",
                "returncode": -1,
                "output": str(e),
                "duration_seconds": 0.0,
            })

    # Generate Markdown Report
    summary_lines = [
        f"# Validation Report: {task_id}",
        "",
        f"- **Overall Result:** {'PASSED ✅' if all_passed else 'FAILED ❌'}",
        f"- **Total Checks:** {len(checks_to_run)}",
        f"- **Execution Mode:** {'Dry Run (Simulated)' if dry_run else 'Live Execution'}",
        "",
        "## Summary of Checks",
        "",
        "| Check | Command | Status | Duration |",
        "| :--- | :--- | :--- | :--- |",
    ]

    for r in results:
        summary_lines.append(
            f"| {r['name']} | `{r['command']}` | {r['status']} | {r['duration_seconds']}s |"
        )

    summary_lines.append("\n## Detailed Outputs\n")
    for r in results:
        summary_lines.append(f"### {r['name']}\n")
        summary_lines.append(f"- **Command:** `{r['command']}`")
        summary_lines.append(f"- **Exit Code:** {r['returncode']}")
        summary_lines.append("```text")
        summary_lines.append(r["output"] or "(No output)")
        summary_lines.append("```\n")

    report_content = "\n".join(summary_lines)
    report_file.write_text(report_content, encoding="utf-8")
    print(f"  📄 Validation report saved to: {report_file.relative_to(repo_root)}")

    return all_passed, report_file

