# Remaining Work — Sprint Plan Status

Status check of `Sprint-Member-Wise.pdf` against the code on `main` (as of 5 Nov 2026).
Task IDs match the PDF and the Task Board workbook.

**Assumed complete (not tracked here):** Shlok's Sprint 2 and 3 work (S2-01 refactor,
S2-10, S2-12, S3-11, and his S3-12 / S3-13 support) and Nisarg's Sprint 3 work (S3-13,
S3-14, and his S3-01 / S3-04 support).

> **Check on Shlok's S2-12:** the code has no `POST /payments/webhook/{gateway}` route and
> no `GET /me/donations` yet. The donation flow is currently create → `/sandbox-payment` →
> `/verify`. Confirm these are in his open work.

## Plan changes since the PDF

- **Earthquake is out of scope.** Only `cyclone`, `industrial_fire` and `urban_flooding` are
  supported (`app/common.py`, `services/ai_provider.py`, `CLAUDE.md`). Ignore the earthquake
  parts of S1-02, S1-10, S1-14, S2-06 and S3-04. The image model's `earthquake` class gives no
  suggestion.
- **Citizen information reply** is at `POST /api/v1/me/incidents/{id}/information`, not
  `/information-response`. It is not in `docs/api_contracts.md` yet.
- **Safety guidance** is a static page (`frontend/src/app/safety`) with a source on each
  guide, not content loaded through the DM content pages. Keep it that way unless S3-04 decides
  otherwise.

## Done (verified in code)

S1-02 migrations 03–09 and seeds · S1-03 register · S1-04 citizen report, my incidents and
timeline (SQLite stand-in removed) · S1-05 / S1-06 auth UI, `/report`, `/my-reports` with
15 s refresh · S1-07 `geo.py` and public incidents API · S1-08 public map, About, How-to ·
S1-11 / S2-02 team recommendations and team-request decisions · S1-13 `/triage` service
(rules baseline) · S1-15 / S2-09 USGS and SACHET CAP adapters, social replay, scheduler,
Poll-now, ingest cron workflow · S1-17 smoke script and seed reset · S2-01 field backend ·
S2-03 dispatcher recommendation, team-requests and resolution-confirm UI · S2-11 public alerts
API and map layer · S2-13 rate limits on register, login and report · S3-09 ingestion health
panel (`/dm/ingestion`) · S3-10 signal text sanitisation (`sanitise_signal_text`).

## Remaining

### 1. AI and ML — critical path

The AI tasks form a chain. Nothing from S2-05 on can finish until the S1-10 dataset is frozen.

| ID | Owner (support) | Remaining | Blocked by |
|---|---|---|---|
| S1-10 | Neeti (Dhruvil, Rudra) | Only 200 synthetic, train-only draft rows exist (`ai-workers/data/rudra_labelled_posts_draft.csv`). Need ≥ 600 labelled items, a human-written test split with ≥ 20 per class split by event, independent labels on the 60 shared rows with agreement reported, and `validate_dataset.py` passing with no leakage. | — |
| S1-12 | Neeti (Dhruvil) | `eval/baselines.py` exists. Run it on the frozen validation split and commit the results table under `docs/ai/`. | S1-10 |
| S1-14 | Dhruvil | Write the class-mapping module (fire → INDUSTRIAL_FIRE, flood → URBAN_FLOODING, hurricane → CYCLONE; everything else gives no suggestion). Neeti signs off the mapping and the accuracy note. | — |
| S2-05 | Neeti (Dhruvil) | Train the char n-gram TF-IDF model and the multilingual-embedding candidate, pick one, set the confidence threshold, write the model card, store the artifact outside git. Target: macro-F1 ≥ 0.75, ≥ 0.10 above rules, per-class recall ≥ 0.60, or the miss written down. | S1-10 |
| S2-06 | Neeti (Dhruvil, Siddh, Tanishq, Rudra) | Make `/triage` use the model and return LOW_CONFIDENCE below the threshold. Add `InProcessProvider` to `get_provider()` (used when `AI_TRIAGE_URL` is empty and a model file exists). Write down the priority rules. Siddh: AI image build in CI/CD and the artifact location. | S2-05 |
| S2-07 | Dhruvil (Zalak, Neeti) | Build ≥ 100 labelled pairs (≥ 40 true duplicates) and the text-similarity module with tuned weights and threshold. Zalak: call it from `GET /dm/incidents/{id}/duplicates` (now `"method": "rules"`) and return the score and explanation. Never auto-merge. Target: precision ≥ 0.80, F1 ≥ rules-only. | S1-10 |
| S2-08 | Zalak (Siddh, Neeti) | Write `ai-workers/service/llm.py` behind `LLM_ENABLED` (off by default), with validated JSON limited to the allowed labels, no PII in prompts, and stub-LLM tests. Siddh puts the key in staging. | Label set (Neeti) |
| S3-05 | Neeti (Dhruvil) | Error analysis by class and language, re-tuned threshold, final model card measured on the untouched test set. | S2-05 |
| S3-06 | Zalak (Neeti, Tanishq) | `/dm/analytics` now groups AI suggestions only by status and human action. Add counts by scenario and **confidence band** (Neeti names the bands), document the definitions. Tanishq draws the chart. | Rehearsal data |
| S3-07 | Neeti (Zalak, Dhruvil) | Define the low-confidence subset, run the LLM and the model on it, record the decision (LLM on only if macro-F1 improves by ≥ 5 points). | S2-05, S2-08 |
| S3-08 | Dhruvil (Tanishq) | Photo-analyse path: optional image input to `/triage` through the S1-14 mapping, plus the upload control and advisory result on the incident page. Never stored as verification. Drop it if the weights are unavailable. | S1-14 |
| S3-10 | Rudra (Neeti) | Sanitisation exists. Still needed: language detection on signal text, an adversarial set extended beyond the 10 S2-06 posts, a test proving no label outside the fixed set and no action is triggered, and Neeti's sign-off. | — |

### 2. Frontend

| ID | Owner (support) | Remaining |
|---|---|---|
| S2-13 | Janvi (Zalak) | Add the information-reply form to My reports for incidents in NEEDS_INFORMATION (backend route exists). Zalak adds the route to `docs/api_contracts.md`. |
| S2-04 | Janvi (Tanishq) | The field page loads assignments once. Add 15-second polling and check the whole flow at phone width with a seeded field user. |
| S1-09 | Tanishq | Legacy pieces are still imported: `AlertsDrawer` (dm shell, home page), `ScenarioWalkthrough` (`/dm`), `role-views/CitizenDashboardView` (citizen dashboard), `duplicateDetection.ts` and `preTriage.ts` (`/report`), `types/resq.ts`. Confirm none of them shows mock data or makes AI-style decisions in the browser on staging. Remove or gate each behind `NEXT_PUBLIC_DEMO_MODE`. |
| S3-03 | Janvi (Tanishq) | Loading, error and empty states; keyboard-only core flows; contrast; phone width; no console errors on the demo path. |
| S3-04 | Tanishq (Nisarg) | Make the About and How-to text match the final screens (field, signals, donations). |

### 3. QA, CI/CD and release

| ID | Owner (support) | Remaining |
|---|---|---|
| — | Siddh | The full `backend/tests` run hangs locally without `TEST_DATABASE_URL` (connection-pool thread does not stop). Fix so the suite exits cleanly. |
| S2-16 | Siddh (Dhruv) | `scripts/smoke.py` covers citizen → verify → public only. Dhruv extends it to the field flow and a donation; Siddh runs it after every staging deploy. |
| S2-14 | Dhruv (Zalak, Nisarg) | Confirm in the CI log that ≥ 40 new DB-backed tests run with none skipped; add OpenAPI contract tests. |
| S2-15 | Siddh (Dhruv) | Update the demo script with the field and AI steps. |
| S3-01 | Dhruv (Zalak, Nisarg) | Playwright specs exist for all three scenarios. Run the cyclone scenario report-to-closure 3 times in a row on staging. |
| S3-02 | Siddh (Dhruv, Zalak, Shlok) | Run the role matrix for all five roles against every route group; confirm `/public/*` and `/me/*` carry no personal data; confirm the citizen and field BFF proxies reject cross-site writes; log every finding in `docs/security-review.md`. |
| S3-12 | Siddh (Shlok, Dhruv) | Final Neon / Render / Vercel config and secrets, migrations on the production-like DB, rollback tags, compose fallback, cold-start mitigation. Dhruv deploys from the docs on a clean machine; target ≤ 30 min. |
| S3-15 | Siddh (all) | Assign roles and run two rehearsals; Dhruv drafts the demo script. |
| S3-16 | Zalak (all, Siddh) | Final report: each member's section by Sprint 3 Day 4, Siddh's architecture and deployment overview, ER and API docs matching the final schema, real vs simulated stated in every section. |
| S3-17 | Dhruv (Siddh) | Keep the P0 / P1 / P2 defect list and report the P0 count at each rehearsal. No P0 open at the tag. |
| S3-18 | Siddh | Freeze, tag, build from the tag, deploy, run smoke. |
| — | Siddh | `.github/CODEOWNERS` names only one owner; add the module owners. |

## Priority order

1. **S1-10 dataset freeze** — unblocks S1-12, S2-05, S2-06, S2-07, S3-05, S3-07.
2. In parallel: **S2-08** (LLM adapter), **S1-14** mapping, **S2-13** reply form, **S2-04** polling, smoke extension (S2-16).
3. **S2-05 → S2-06** model integration, then **S2-07** duplicates v2.
4. Sprint 3 hardening: S3-02, S3-01, S3-12, then S3-05 / S3-06 / S3-07 / S3-08 on rehearsal data.
5. Release: S3-15 → S3-16 → S3-17 → S3-18.
