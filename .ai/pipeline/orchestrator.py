"""DRCH Master AI Pipeline Orchestrator.

Coordinates the 9-stage engineering lifecycle between Google Antigravity,
Claude Code, and Human-in-the-Loop review.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from .claude_runner import detect_claude_cli, invoke_claude
from .planner import generate_plan
from .reviewer import run_code_review
from .state_manager import StateManager, TaskState
from .validator import execute_validation_checks

logger = logging.getLogger("drch.ai.orchestrator")


class PipelineOrchestrator:
    def __init__(self, repo_root: Path, config_path: Optional[Path] = None):
        self.repo_root = repo_root.resolve()
        self.ai_dir = self.repo_root / ".ai"
        self.tasks_dir = self.ai_dir / "tasks"
        self.reports_dir = self.ai_dir / "reports"
        self.handoffs_dir = self.ai_dir / "handoffs"

        self.config_path = config_path or (self.ai_dir / "pipeline" / "config.json")
        self.config = self._load_config()

        self.state_mgr = StateManager(self.tasks_dir)

    def _load_config(self) -> Dict[str, Any]:
        default_config = {
            "claude_command": ["claude", "-p"],
            "model": None,
            "permission_mode": "default",
            "auto_approve_plan": False,
            "auto_approve_checks": False,
        }
        if self.config_path.exists():
            try:
                loaded = json.loads(self.config_path.read_text(encoding="utf-8"))
                default_config.update(loaded)
            except Exception as e:
                logger.warning(f"Failed to parse config file: {e}")
        return default_config

    def doctor(self) -> bool:
        """Run diagnostic checks on the development environment."""
        print("\n🏥 DRCH AI Orchestration Doctor")
        print("=" * 50)
        all_ok = True

        # Python Version
        py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        if sys.version_info >= (3, 11):
            print(f"✅ Python: {py_ver} (>= 3.11)")
        else:
            print(f"❌ Python: {py_ver} (Requires 3.11+)")
            all_ok = False

        # Git
        git_path = shutil.which("git")
        if git_path:
            try:
                proc = subprocess.run(["git", "--version"], capture_output=True, text=True, timeout=5)
                print(f"✅ Git: {proc.stdout.strip()}")
            except Exception:
                print(f"✅ Git: {git_path}")
        else:
            print("❌ Git: Not found in PATH")
            all_ok = False

        # Node / npm
        node_path = shutil.which("node")
        if node_path:
            try:
                proc = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=5)
                print(f"✅ Node.js: {proc.stdout.strip()}")
            except Exception:
                print(f"✅ Node.js: {node_path}")
        else:
            print("⚠️ Node.js: Not found in PATH (Frontend checks may be limited)")

        # Claude Code CLI
        claude_info = detect_claude_cli()
        if claude_info["installed"]:
            print(f"✅ Claude Code CLI: {claude_info['version']} ({claude_info['path']})")
        else:
            print("⚠️ Claude Code CLI: Not installed or not in PATH")
            print("   (Install via: npm install -g @anthropic-ai/claude-code for Mode B/C)")

        # Repository Rules
        agents_md = self.repo_root / "AGENTS.md"
        claude_md = self.repo_root / "CLAUDE.md"
        arch_doc = self.repo_root / "docs" / "ARCHITECTURE.md"

        if agents_md.exists():
            print("✅ AGENTS.md: Found")
        else:
            print("❌ AGENTS.md: Missing")
            all_ok = False

        if claude_md.exists():
            print("✅ CLAUDE.md: Found")
        else:
            print("❌ CLAUDE.md: Missing")
            all_ok = False

        if arch_doc.exists():
            print("✅ docs/ARCHITECTURE.md: Found")
        else:
            print("❌ docs/ARCHITECTURE.md: Missing")
            all_ok = False

        # Claude Settings & Git Deny Rules
        claude_settings = self.repo_root / ".claude" / "settings.json"
        if claude_settings.exists():
            try:
                st = json.loads(claude_settings.read_text(encoding="utf-8"))
                deny_rules = st.get("permissions", {}).get("deny", [])
                if any("git commit" in r for r in deny_rules):
                    print(f"✅ Claude Deny Rules: Active ({len(deny_rules)} rules configured)")
                else:
                    print("⚠️ Claude Deny Rules: Missing explicit git deny permissions")
            except Exception:
                print("❌ Claude settings: Invalid JSON")
        else:
            print("❌ .claude/settings.json: Missing")
            all_ok = False

        # Antigravity Rules
        rules_dir = self.repo_root / ".agents" / "rules"
        if rules_dir.exists() and len(list(rules_dir.glob("*.md"))) >= 4:
            print(f"✅ Antigravity Rules: Found {len(list(rules_dir.glob('*.md')))} rules")
        else:
            print("⚠️ Antigravity Rules: Incomplete in .agents/rules/")

        print("=" * 50)
        status_msg = "All core systems operational! 🚀" if all_ok else "Some checks require attention."
        print(f"Status: {status_msg}\n")
        return all_ok

    def list_tasks(self) -> None:
        """Display previous orchestrator tasks and their statuses."""
        tasks = self.state_mgr.list_tasks()
        if not tasks:
            print("No tasks found in `.ai/tasks/`.")
            return

        print(f"\n📋 Registered Tasks ({len(tasks)}):")
        print(f"{'Task ID':<30} {'Status':<16} {'Created At':<22} {'Description'}")
        print("-" * 90)
        for t in tasks:
            print(f"{t['task_id']:<30} {t['status']:<16} {t['created_at'][:19]:<22} {t['description']}")
        print()

    def generate_antigravity_handoff(self, state: TaskState, plan_file: Optional[Path]) -> Path:
        """Generate a handoff document for continuing implementation in Antigravity."""
        self.handoffs_dir.mkdir(parents=True, exist_ok=True)
        handoff_file = self.handoffs_dir / f"{state.task_id}_antigravity_handoff.md"

        plan_ref = plan_file.name if plan_file else "None"
        content = f"""# Antigravity Handoff: {state.task_description}

- **Task ID:** `{state.task_id}`
- **Current Status:** `{state.status}`
- **Implementation Plan:** `.ai/reports/{plan_ref}`

## Instructions for Antigravity:
1. Open this workspace in Google Antigravity.
2. Review the plan at `.ai/reports/{plan_ref}`.
3. Review `docs/ARCHITECTURE.md` and `AGENTS.md`.
4. Apply the required code changes with minimal, targeted modifications.
5. After implementation, run:
   ```powershell
   python scripts/ai-dev.py --resume {state.task_id} --step validate
   ```
"""
        handoff_file.write_text(content, encoding="utf-8")
        print(f"  📝 Antigravity handoff instruction created: {handoff_file.relative_to(self.repo_root)}")
        return handoff_file

    def run(
        self,
        task_description: str,
        dry_run: bool = False,
        resume_task_id: Optional[str] = None,
        target_step: Optional[str] = None,
    ) -> bool:
        """Execute the end-to-end orchestration workflow."""
        print("\n🚀 DRCH AI Orchestration Pipeline")
        print("=" * 60)
        print(f"Repository: {self.repo_root}")
        print(f"Mode: {'DRY RUN (Simulation)' if dry_run else 'LIVE EXECUTION'}")

        # Stage 1: Task Initialization / Resumption
        if resume_task_id:
            state = self.state_mgr.load_task(resume_task_id)
            if not state:
                print(f"❌ Error: Task {resume_task_id} not found.")
                return False
            print(f"🔄 Resuming Task: {state.task_id} (Status: {state.status})")
        else:
            state = self.state_mgr.create_task(task_description)
            print(f"✨ Initialized Task: {state.task_id}")
            print(f"📝 Description: {state.task_description}")

        # Stage 2 & 3: Planning
        plan_file: Optional[Path] = self.reports_dir / f"{state.task_id}_plan.md"
        plan_text: Optional[str] = None

        planning_already_done = (
            state.stages.get("planning", {}).get("status") == "COMPLETED"
            and plan_file.exists()
        )

        if not target_step or target_step in ["plan", "all"]:
            if planning_already_done and target_step != "plan":
                print(f"  ℹ️ Using existing approved plan: {plan_file.relative_to(self.repo_root)}")
            else:
                self.state_mgr.transition(state, "PLANNING")
                plan_text, plan_file = generate_plan(
                    task_id=state.task_id,
                    task_description=state.task_description,
                    repo_root=self.repo_root,
                    reports_dir=self.reports_dir,
                    config=self.config,
                    dry_run=dry_run,
                )
                if not plan_file:
                    print("❌ Planning failed or aborted.")
                    self.state_mgr.transition(state, "FAILED_PLANNING")
                    return False

                self.state_mgr.record_stage(
                    state=state,
                    stage_name="planning",
                    status="COMPLETED",
                    payload={"plan_file": str(plan_file)},
                )

        # Stage 4: Human Plan Approval Gate (Only if freshly planned)
        if not planning_already_done and not self.config.get("auto_approve_plan", False) and not dry_run:
            print("\n" + "=" * 60)
            print(f"🛑 HUMAN APPROVAL REQUIRED: Implementation Plan ({state.task_id})")
            print(f"   Review the plan at: {self.reports_dir / f'{state.task_id}_plan.md'}")
            print("=" * 60)
            choice = input("Proceed with implementation? [Y/n/handoff]: ").strip().lower()
            if choice == "handoff":
                handoff_path = self.generate_antigravity_handoff(state, plan_file)
                self.state_mgr.transition(state, "HANDED_OFF_TO_ANTIGRAVITY", {"handoff_file": str(handoff_path)})
                print(f"✅ Handed off to Google Antigravity. Resume pipeline later with:")
                print(f"   python scripts/ai-dev.py --resume {state.task_id} --step validate")
                return True
            elif choice != "y" and choice != "":
                print("⏹️ Task halted by user.")
                self.state_mgr.transition(state, "HALTED_BY_USER")
                return False

        # Stage 5: Implementation Execution
        if not target_step or target_step in ["implement", "all"]:
            self.state_mgr.transition(state, "IMPLEMENTING")
            print("\n🛠️ Stage 5: Executing Implementation via Claude Code...")
            impl_prompt = f"""You are implementing the approved plan for DRCH.
Task: {state.task_description}
Plan location: .ai/reports/{state.task_id}_plan.md

Follow all DRCH constraints:
- Neon PostGIS only (no Supabase Auth)
- Argon2id & RBAC intact
- Minimal targeted edits
- Do NOT run git commit or git push

Implement the required code changes now."""

            impl_result = invoke_claude(
                prompt=impl_prompt,
                config=self.config,
                label=f"Implementation for {state.task_id}",
                cwd=self.repo_root,
                dry_run=dry_run,
            )

            if not impl_result and not dry_run:
                print("\n⚠️ Claude Code was unable to complete implementation (rate limit or CLI unavailable).")
                print("🔄 Creating Google Antigravity handoff to continue task seamlessly...")
                handoff_path = self.generate_antigravity_handoff(state, plan_file)
                self.state_mgr.transition(
                    state,
                    "HANDED_OFF_TO_ANTIGRAVITY",
                    {"handoff_file": str(handoff_path), "reason": "claude_limit_or_unavailable"},
                )
                print("✅ Handed off to Google Antigravity. Open the workspace in Antigravity to apply edits.")
                print(f"   When finished, resume validation with:")
                print(f"   python scripts/ai-dev.py --resume {state.task_id} --step validate\n")
                return True

            self.state_mgr.record_stage(
                state=state,
                stage_name="implementation",
                status="COMPLETED" if impl_result else "FAILED",
                payload={"result_preview": (impl_result or "")[:500]},
            )

        # Stage 6: Automated Verification & Validation
        if not target_step or target_step in ["validate", "all"]:
            self.state_mgr.transition(state, "VALIDATING")
            passed, val_report = execute_validation_checks(
                task_id=state.task_id,
                repo_root=self.repo_root,
                reports_dir=self.reports_dir,
                dry_run=dry_run,
                prompt_approval=not self.config.get("auto_approve_checks", False) and not dry_run,
            )
            self.state_mgr.record_stage(
                state=state,
                stage_name="validation",
                status="PASSED" if passed else "FAILED",
                payload={"report_file": str(val_report), "passed": passed},
            )

        # Stage 7: Independent Code Review
        if not target_step or target_step in ["review", "all"]:
            self.state_mgr.transition(state, "REVIEWING")
            rev_text, rev_file = run_code_review(
                task_id=state.task_id,
                task_description=state.task_description,
                repo_root=self.repo_root,
                reports_dir=self.reports_dir,
                config=self.config,
                dry_run=dry_run,
            )
            if rev_file:
                self.state_mgr.record_stage(
                    state=state,
                    stage_name="review",
                    status="COMPLETED",
                    payload={"review_file": str(rev_file)},
                )

        # Stage 8 & 9: Completion Summary
        self.state_mgr.transition(state, "COMPLETED")
        print("\n" + "=" * 60)
        print(f"🎉 Pipeline Workflow Completed for Task: {state.task_id}")
        print("=" * 60)
        print(f"📊 Status: {state.status}")
        print(f"📁 Reports Generated in: {self.reports_dir.relative_to(self.repo_root)}")
        print("\nNext Steps:")
        print("1. Review git status and git diff manually.")
        print("2. Commit using your preferred git workflow when fully satisfied.")
        print("=" * 60 + "\n")
        return True

