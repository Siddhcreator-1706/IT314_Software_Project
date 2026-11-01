"""DRCH Task State Management.

Persists multi-stage task lifecycle state into `.ai/tasks/<task_id>.json`
allowing safe resumption, auditing, and decoupling between stages.
"""

from __future__ import annotations

import datetime
import json
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class TaskState:
    task_id: str
    task_description: str
    created_at: str
    updated_at: str
    status: str
    stages: Dict[str, Any] = field(default_factory=dict)
    history: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TaskState:
        return cls(
            task_id=data["task_id"],
            task_description=data["task_description"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            status=data["status"],
            stages=data.get("stages", {}),
            history=data.get("history", []),
        )


class StateManager:
    def __init__(self, tasks_dir: Path):
        self.tasks_dir = tasks_dir
        self.tasks_dir.mkdir(parents=True, exist_ok=True)

    def create_task(self, description: str) -> TaskState:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        short_id = uuid.uuid4().hex[:6]
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        task_id = f"task_{timestamp}_{short_id}"

        state = TaskState(
            task_id=task_id,
            task_description=description.strip(),
            created_at=now,
            updated_at=now,
            status="INITIALIZED",
            stages={},
            history=[{"timestamp": now, "status": "INITIALIZED", "event": "Task created"}],
        )
        self.save_task(state)
        return state

    def save_task(self, state: TaskState) -> Path:
        state.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        path = self.tasks_dir / f"{state.task_id}.json"
        path.write_text(json.dumps(state.to_dict(), indent=2), encoding="utf-8")
        return path

    def load_task(self, task_id: str) -> Optional[TaskState]:
        path = self.tasks_dir / f"{task_id}.json"
        if not path.exists():
            candidates = list(self.tasks_dir.glob(f"*{task_id}*.json"))
            if candidates:
                path = candidates[0]
            else:
                return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return TaskState.from_dict(data)

    def list_tasks(self) -> List[Dict[str, Any]]:
        tasks = []
        for p in sorted(self.tasks_dir.glob("task_*.json"), reverse=True):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                tasks.append({
                    "task_id": data.get("task_id", p.stem),
                    "status": data.get("status", "UNKNOWN"),
                    "created_at": data.get("created_at", ""),
                    "description": data.get("task_description", "")[:60],
                })
            except Exception:
                continue
        return tasks

    def transition(
        self, state: TaskState, new_status: str, metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        state.status = new_status
        state.history.append({
            "timestamp": now,
            "status": new_status,
            "metadata": metadata or {},
        })
        self.save_task(state)

    def record_stage(
        self, state: TaskState, stage_name: str, status: str, payload: Dict[str, Any]
    ) -> None:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        state.status = status
        state.stages[stage_name] = {
            "completed_at": now,
            "status": status,
            **payload,
        }
        state.history.append({
            "timestamp": now,
            "stage": stage_name,
            "status": status,
        })
        self.save_task(state)

