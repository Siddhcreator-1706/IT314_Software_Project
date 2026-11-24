# ResQ documentation

Documents are grouped by purpose. Start with the architecture reference, then open the folder you need.

| Folder | What it holds |
|---|---|
| [`architecture/`](architecture/) | How the system fits together and the contracts to code against: [ARCHITECTURE.md](architecture/ARCHITECTURE.md), the [REST API contracts](architecture/api_contracts.md) (with the standard error format), the [environment variables](architecture/env-variables.md) register, the generated [ER diagram](architecture/er-diagram.md), the [class diagrams](architecture/class-diagram.md), the [sequence diagrams](architecture/sequence-diagram.md) and [related-signal matching](architecture/signal-matching.md). |
| [`ai/`](ai/) | AI triage and models: [folder scope](ai/folder-scope.md), [model card](ai/model-card.md), [triage rules](ai/triage-rules.md), [text and image classifiers](ai/models.md), [English text model](ai/text-model.md), [evaluation report](ai/evaluation-report.md), dataset docs, and saved results in [`ai/reports/`](ai/reports/). |
| [`guides/`](guides/) | How to use and work on the product: the [citizen and field guide](guides/frontend-citizen-field-guide.md), the [dispatcher and public portal guide](guides/frontend-dispatcher-public-guide.md), [payments and donations](guides/payments.md) and the [AI agent workflow guide](guides/AI_WORKFLOW.md). |
| [`operations/`](operations/) | Running it: the [release runbook](operations/release-runbook.md), the [migration runbook](operations/runbook-migration.md) and the [ingestion sources](operations/ingestion-sources.md) memo. |
| [`quality/`](quality/) | Testing and review: the [test suite reference](quality/testing.md), [load test](quality/load-test.md), [security review](quality/security-review.md), [defect list](quality/defect-list.md) and [payment gateway findings](quality/payment-gateway-findings.md). |
| [`project/`](project/) | Course deliverables: the [final report](project/final-report.md) and its [dispatch and field section](project/final-report-dispatch-field.md), the [demo script](project/demo-script.md) and [`sprints/`](project/sprints/) (the sprint plan of record, Markdown source and PDF). |
| [`submission/`](submission/) | IT314 final submission set (Group 30): [index](submission/README.md) with SRS v2, use cases, user stories and backlog v6, sprint details with class and sequence diagrams, system and object design, UML diagrams, requirements not implemented, contribution document, slide content, other artifacts, and the requirements and planning report v2 (with where the mid-evaluation originals are kept). |

New documents go in the folder that matches their purpose; add them to this table.
