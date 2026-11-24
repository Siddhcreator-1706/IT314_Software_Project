# ResQ: Other Artifacts

Group 30. This is an index of the supporting artifacts that are not separate submission documents.

## 1. Links

| Item | Value |
|---|---|
| Live deployment | https://it-314-software-project.vercel.app/ |
| Backend health (production) | `https://it314-software-project-backend1.onrender.com/api/v1/health` (free tier: the first request may take up to a minute to wake the service) |
| GitHub repository | https://github.com/Siddhcreator-1706/IT314_Software_Project |

## 2. Mid-evaluation submission (baseline)

The mid-evaluation SRS, story workbook, planning report and ER diagram are kept in git history (`b12ef62^:documents/`) rather than committed again. Their corrected successors, and the problems that made replacing them necessary, are listed in [12-requirements-planning-report-v2.md §0](12-requirements-planning-report-v2.md#0-mid-evaluation-baseline-and-what-replaced-it).

## 3. Design and architecture references

| Artifact | Where |
|---|---|
| Architecture reference | [docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) |
| REST API contracts and the standard error format | [docs/architecture/api_contracts.md](../architecture/api_contracts.md) |
| ER diagram (generated, 35 tables) | [docs/architecture/er-diagram.md](../architecture/er-diagram.md) |
| Environment variables (names only) | [docs/architecture/env-variables.md](../architecture/env-variables.md) |
| Related-signal matching design | [docs/architecture/signal-matching.md](../architecture/signal-matching.md) |
| UML sources and images | [diagrams/](diagrams/) |
| Architecture class and sequence diagrams (Mermaid) | [class-diagram.md](../architecture/class-diagram.md), [sequence-diagram.md](../architecture/sequence-diagram.md) |

## 4. UI/UX

The UI was designed directly in code rather than in a separate wireframe tool. The screens are described page by page in the user guides:

- [Citizen and field guide](../guides/frontend-citizen-field-guide.md): sign-up and sign-in, report form, My reports, donations, field app.
- [Dispatcher and public portal guide](../guides/frontend-dispatcher-public-guide.md): public map, DM console pages, admin console.
- Brand assets: `frontend/public/logo*.svg`, `frontend/src/app/icon.svg`.
- Design-system primitives: `frontend/src/components/ui.tsx`, `badges.tsx`.

## 5. AI artifacts

| Artifact | Where |
|---|---|
| Model card (rules baseline) | [docs/ai/model-card.md](../ai/model-card.md) |
| Triage rules | [docs/ai/triage-rules.md](../ai/triage-rules.md) |
| Evaluation report and LLM decision | [docs/ai/evaluation-report.md](../ai/evaluation-report.md) |
| Text and image classifiers | [docs/ai/models.md](../ai/models.md), [docs/ai/text-model.md](../ai/text-model.md) |
| Dataset guideline and sources | [docs/ai/text-label-guideline.md](../ai/text-label-guideline.md), [docs/ai/text-dataset-sources.md](../ai/text-dataset-sources.md) |
| Saved evaluation results | [docs/ai/reports/](../ai/reports/) |

## 6. Operations and quality

| Artifact | Where |
|---|---|
| Release runbook (deploy, tag, rollback) | [docs/operations/release-runbook.md](../operations/release-runbook.md) |
| Migration and backup runbook | [docs/operations/runbook-migration.md](../operations/runbook-migration.md) |
| Ingestion sources memo | [docs/operations/ingestion-sources.md](../operations/ingestion-sources.md) |
| Demo script and rehearsal log | [docs/project/demo-script.md](../project/demo-script.md) |
| Final report (by module) | [docs/project/final-report.md](../project/final-report.md) |
| Security review | [docs/quality/security-review.md](../quality/security-review.md) |
| Load test | [docs/quality/load-test.md](../quality/load-test.md) |
| Defect list | [docs/quality/defect-list.md](../quality/defect-list.md) |
| Payment gateway findings | [docs/quality/payment-gateway-findings.md](../quality/payment-gateway-findings.md) |
| Test suite reference (the testing documents follow separately) | [docs/quality/testing.md](../quality/testing.md) |

## 7. Repository process artifacts

- Pull request template: `.github/PULL_REQUEST_TEMPLATE.md`
- Issue forms: `.github/ISSUE_TEMPLATE/`
- CODEOWNERS: `.github/CODEOWNERS`
- CI, CD, CodeQL and ingestion cron: `.github/workflows/`
- Contribution guide: `CONTRIBUTING.md`
- Agent rules: `AGENTS.md`, `CLAUDE.md`, `.agents/rules/`, [AI workflow guide](../guides/AI_WORKFLOW.md)
