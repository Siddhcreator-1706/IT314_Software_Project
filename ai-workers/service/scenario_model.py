"""Optional trained scenario classifier for /triage (S2-06). Owner: Neeti.

/triage always computes the rules result (``rules.py``). When ``TRIAGE_MODEL_DIR`` points at a trained scenario
model whose labels cover the three supported scenarios, the model's scenario and confidence replace the rules'
scenario and confidence. Priority and its factors still come from the written priority rules
(docs/ai/triage-rules.md). Without an artifact, or with one that fails a check, /triage stays on the rules and
says so in ``GET /health``.

The backend still applies its own guardrails: a confidence below ``AI_LOW_CONFIDENCE_THRESHOLD`` becomes
``LOW_CONFIDENCE`` and ``OTHER`` is flagged out of scope. Nothing here can change an incident.

Artifact contract (written by the S2-05 training script, never committed to git):

    <TRIAGE_MODEL_DIR>/scenario_model.joblib   dict with "pipeline" (a scikit-learn estimator over raw text with
                                              predict_proba and classes_), "model_name", "scikit_learn_version"
    <TRIAGE_MODEL_DIR>/metadata.json           {"artifact": {"sha256": "<SHA-256 of scenario_model.joblib>"}, ...}

``metadata.json`` is required: joblib unpickles, which can run code, so an artifact is loaded only when its
SHA-256 matches. Class labels are the dataset labels of docs/ai/text-label-guideline.md.

Hosted model: when no local artifact is loaded and ``TRIAGE_TEXT_MODEL_URL`` is set (for example
``https://indicbert-disaster-api.onrender.com/predict``), the scenario comes from that multilingual text classifier
instead (``RemoteScenarioModel``). It receives only the description the backend already PII-scrubbed. Its classes
Fire, Earthquake, Cyclone, Flood and Non-Disaster map onto the dataset labels below. A slow, failed or malformed
answer leaves the rules result in place, so a sleeping free-tier host never blocks triage.
"""

from __future__ import annotations

import json
import logging
import math
import os
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)

REMOTE_MODEL_NAME = "indicbert-disaster-api"
# Shorter than the backend's 10 s wait for /triage (backend/app/services/ai_provider.py), so a slow model still
# leaves time to return the rules answer.
REMOTE_TIMEOUT_SECONDS = 6
REMOTE_MAX_TEXT_CHARS = 4000
REMOTE_LABELS = {
    "cyclone": "cyclone",
    "flood": "flood",
    "fire": "fire",
    "earthquake": "earthquake",
    "non_disaster": "not_disaster",
}

ARTIFACT_NAME = "scenario_model.joblib"
LABEL_TO_SCENARIO = {
    "cyclone": "CYCLONE",
    "flood": "URBAN_FLOODING",
    "fire": "INDUSTRIAL_FIRE",
    # Not supported scenarios: the backend shows them as out of scope for manual triage.
    "earthquake": "OTHER",
    "other_disaster": "OTHER",
    "not_disaster": "OTHER",
}
REQUIRED_LABELS = frozenset({"cyclone", "flood", "fire"})


class ScenarioModel(Protocol):
    name: str

    def predict(self, text: str) -> tuple[str, float]:
        """Return the dataset label and its probability for one text."""
        ...


class SklearnScenarioModel:
    """Wraps a trained scikit-learn text pipeline (for example TF-IDF character n-grams + logistic regression)."""

    def __init__(self, bundle: dict[str, Any]):
        self.pipeline = bundle["pipeline"]
        self.name = str(bundle.get("model_name") or "drch-triage-text-model")[:100]
        labels = {str(label).lower() for label in self.pipeline.classes_}
        missing = REQUIRED_LABELS - labels
        if missing:
            raise ValueError(f"model labels do not cover {sorted(missing)}")
        unknown = labels - set(LABEL_TO_SCENARIO)
        if unknown:
            raise ValueError(f"model has labels outside the dataset schema: {sorted(unknown)}")

    def predict(self, text: str) -> tuple[str, float]:
        probabilities = self.pipeline.predict_proba([text])[0]
        index = int(probabilities.argmax())
        return str(self.pipeline.classes_[index]).lower(), float(probabilities[index])


@lru_cache(maxsize=2)
def load_model(model_dir: str) -> SklearnScenarioModel | None:
    """Load and check the artifact once per process; return None (rules stay in use) on any problem."""
    path = Path(model_dir) / ARTIFACT_NAME
    if not path.is_file():
        logger.info("No scenario model at %s; /triage uses the rules", path)
        return None
    if not (path.parent / "metadata.json").is_file():
        logger.warning("Scenario model has no metadata.json with its SHA-256; not loaded")
        return None
    try:
        import joblib
        import sklearn

        from text_model.inference import ModelIntegrityError, _verify_artifact_hash

        _verify_artifact_hash(path)
        # Unpickled only after the SHA-256 check above.
        bundle = joblib.load(path)  # nosec B301
        if bundle.get("scikit_learn_version") != sklearn.__version__:
            logger.warning("Scenario model needs scikit-learn %s; runtime has %s; not loaded",
                           bundle.get("scikit_learn_version"), sklearn.__version__)
            return None
        return SklearnScenarioModel(bundle)
    except (ModelIntegrityError, OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("Scenario model not loaded: %s", exc)
        return None


class RemoteScenarioModel:
    """Calls a hosted text classifier: POST {"text": ...} -> {"prediction", "confidence", "probabilities"}."""

    name = REMOTE_MODEL_NAME
    # The hosted model's Fire class covers any fire, so a fire answer carries a note to confirm it is industrial.
    generic_fire = True

    def __init__(self, url: str):
        # Only web URLs: the value comes from the environment, so refuse file: and other schemes.
        if not url.lower().startswith(("https://", "http://")):
            raise ValueError("TRIAGE_TEXT_MODEL_URL must be http or https")
        self.url = url

    def predict(self, text: str) -> tuple[str, float]:
        request = urllib.request.Request(
            self.url,
            data=json.dumps({"text": text[:REMOTE_MAX_TEXT_CHARS]}).encode(),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=REMOTE_TIMEOUT_SECONDS) as response:  # nosec B310 - scheme checked in __init__
                raw = json.loads(response.read())
        except (OSError, ValueError) as exc:  # URLError, HTTPError and timeouts are OSError
            raise RuntimeError(f"text model request failed: {type(exc).__name__}") from exc
        if not isinstance(raw, dict):
            raise ValueError("text model answer was not an object")
        key = str(raw.get("prediction", "")).strip().casefold().replace("-", "_").replace(" ", "_")
        label = REMOTE_LABELS.get(key)
        confidence = raw.get("confidence")
        if label is None or isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
            raise ValueError("text model answer had an unknown class or no confidence")
        if not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError("text model confidence was outside [0, 1]")
        return label, float(confidence)


def configured_model() -> ScenarioModel | None:
    """A checked local artifact wins; otherwise the hosted model when its URL is set; otherwise the rules."""
    model_dir = os.getenv("TRIAGE_MODEL_DIR")
    local = load_model(model_dir) if model_dir else None
    if local is not None:
        return local
    url = (os.getenv("TRIAGE_TEXT_MODEL_URL") or "").strip()
    if not url:
        return None
    try:
        return RemoteScenarioModel(url)
    except ValueError as exc:
        logger.warning("Hosted scenario model not used: %s", exc)
        return None


def engine_name(model: ScenarioModel | None) -> str:
    return f"model:{model.name}" if model else "rules"


def apply_model(result: dict, payload: dict, model: ScenarioModel | None) -> dict:
    """Replace the rules' scenario and confidence with the model's; keep the rules' priority and its factors."""
    description = (payload.get("description") or "").strip()
    if model is None or not description:
        return result
    try:
        label, probability = model.predict(description)
    except (ValueError, TypeError, AttributeError, IndexError, RuntimeError) as exc:
        logger.warning("Scenario model prediction failed (%s); using the rules result", type(exc).__name__)
        return result

    scenario = LABEL_TO_SCENARIO.get(label, "OTHER")
    confidence = round(min(max(probability, 0.0), 1.0), 3)
    reported = (payload.get("reported_scenario") or "").strip().upper().replace(" ", "_")
    notes = []
    if reported in {"CYCLONE", "INDUSTRIAL_FIRE", "URBAN_FLOODING"} and reported != scenario:
        notes.append(f"The text model reads this as {scenario.lower()} rather than the reported {reported.lower()}.")
    if scenario == "OTHER":
        notes.append(f"The text model labelled it {label}, which is not one of the three supported scenarios.")
    if label == "fire" and getattr(model, "generic_fire", False):
        notes.append("The text model's fire class is generic; confirm it is an industrial fire.")

    factors = [f for f in result.get("factors", []) if f.get("name") != "scenario_keywords"]
    factors.insert(0, {"name": "text_model", "detail": f"{label} ({confidence:.2f})", "weight": confidence})
    return {
        **result,
        "model": model.name,
        "scenario": scenario,
        "confidence": confidence,
        "uncertainty": " ".join(notes) or None,
        "factors": factors,
    }
