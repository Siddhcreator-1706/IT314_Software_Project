# Sprint 3 — Dispatch, field and public backend (Nisarg)

Scope from `docs/sprints/Sprint-Member-Wise.pdf`, Nisarg's Sprint 3 section:

| Task | Role | What this change delivers | Status |
| :--- | :--- | :--- | :--- |
| S3-14 Team-recommendation tuning | Owner | Tuned rules and weights, two ranking bugs fixed, 10-incident benchmark harness, review sheet, regression tests | **Done & Signed Off** (Siddh & Tanishq: 10/10 Agree) |
| S3-13 Performance smoke (EXPLAIN part) | Owner | `scripts/explain_queries.py` for the public-map and recommendation queries; index analysis below | **Done & Measured on Staging** (`docs/perf/explain-staging.md`) |
| S3-01 Scenario tests (assignment and field steps) | Support (owner Dhruv) | `backend/tests/test_scenario_dispatch_field_flow.py` with reusable step helpers | Written; runs in CI's PostGIS job (not run locally, see blockers) |
| S3-04 Safety guidance source check | Support (owner Tanishq) | Source check of `/safety` guidance against NDMA pages (section 5) | Report done; frontend edit left to Tanishq |
| S3-16 Docs | Team-wide | `docs/api_contracts.md` section 6 brought in line with the code | Done |
| S3-17 Defect buffer | Team-wide | Recommendation bugs fixed (section 1.2) | Done |

The k6/Locust script and the p95 measurement in S3-13 are Shlok's part and are not in this change.

---

## 1. S3-14 Team-recommendation tuning

### 1.1 Method

`scripts/evaluate_team_recommendations.py` ranks the top 3 teams for 10 benchmark incidents
(4 urban floods, 3 industrial fires, 3 cyclones across Ahmedabad, Surat, Vadodara, Rajkot,
Kutch, Jamnagar and Gir Somnath) against the 14 TEAM rows of the demo seed, parsed straight from
`backend/db/seeds/demo/90_demo_incidents.sql`. With `--database-url` it reads the AVAILABLE teams
of a live database instead (read-only). The output is the review sheet
[`docs/s3-14-recommendation-review-sheet.md`](s3-14-recommendation-review-sheet.md), with two
reviewer rows per incident.

### 1.2 Findings on the Sprint 2 engine and fixes

| # | Finding (Sprint 2 behaviour) | Fix |
| :--- | :--- | :--- |
| 1 | **Seed teams were invented when the database had none available.** With a live database, an empty answer (every team busy) fell back to the in-memory seed list, showing dispatchers teams with IDs that do not exist. A query error did the same. | With a connection the PostGIS answer is authoritative; empty stays empty and errors propagate (the global handler answers 503). Seed teams are used only when `DATABASE_URL` is unset. The approve-backup draft then says "manual allocation required". |
| 2 | **A team with no relevant capability could outrank a capable team.** C1 and C2 (cyclones) had a Rajkot fire tender with no cyclone capability at rank 3, ahead of capable SAR teams, because 0 points minus a small distance beat 10 points minus a large one. | Every team with at least one primary match ranks above every team with none. |
| 3 | **Synonym tags were counted separately.** `fire`, `fire_tender` and `water_tender` each scored 10, so tag-rich teams beat closer teams that can do the same job. F3 (Vadodara flood) left the local boat team (1 km) out of the top 3; I2 (Naroda GIDC fire) kept local fire tenders first by only 0.5 points, and the order flipped once the seed's `industrial_fire` tag was counted. | Primary capabilities are grouped by job (water rescue, dewatering, firefighting, hazmat, rescue, debris clearing, shelter, first aid) and a team scores once per group. |
| 4 | **Seed tags ignored by the rules.** The seed uses `industrial_fire` (Hazira team) and `medical` (ambulances, Surat SDRF), which no rule mentioned. | `industrial_fire` added to the fire hazmat group; `medical` added as a secondary tag for cyclone and fire. |
| 5 | **Misleading reason text.** Every exact match said "closest proximity" whatever the distance. | Reasons are factual: the groups covered, secondary tags, the distance, and "(nearest capable team)" only when it is true. |
| 6 | **Distance under-weighted.** At 0.05 per km a team needed 200 km more travel to lose one capability. | 0.08 per km: 125 km of travel costs one capability group. |

Final formula: `score = groups × 10 + secondary tags × 3 − km × 0.08`, with capable teams first.
The response gains three additive fields: `secondary_match`, `matched_count` and `score`.

### 1.3 Before and after (top 3, demo seed)

| Incident | Sprint 2 top 3 | S3-14 top 3 |
| :--- | :--- | :--- |
| F1 Ahmedabad flood | NDRF 602 (2 km), SDRF Gandhinagar (21), SDRF Rajkot (198) | NDRF 602 (2), SDRF Gandhinagar (21), NDRF 601 Vadodara (103) |
| F2 Surat flood | NDRF 602 (204), SDRF Gandhinagar (225), SDRF Rajkot (240) | NDRF 602 (204), NDRF 601 Vadodara (130), SDRF Rajkot (240) |
| F3 Vadodara flood | NDRF 602 (100), SDRF Gandhinagar (114), SDRF Rajkot (244) | **NDRF 601 Vadodara (1)**, NDRF 602 (100), SDRF Gandhinagar (114) |
| F4 Rajkot flood | SDRF Rajkot (2), NDRF 602 (198), SDRF Gandhinagar (214) | SDRF Rajkot (2), **NDRF 603 Jamnagar (80)**, NDRF 602 (198) |
| I1 Hazira fire | Hazira team (0), AFES 2 (209), AFES 1 (216) | Hazira team (0), AFES 1 (216), AFES 2 (209) |
| I2 Naroda GIDC fire | AFES 1 (11), AFES 2 (12), Hazira team (220) | AFES 1 (11), AFES 2 (12), Hazira team (220) — now by a wide margin |
| I3 Nandesari GIDC fire | Hazira team (152), AFES 2 (81), AFES 1 (89) | Hazira team (152), AFES 1 (89), AFES 2 (81) |
| C1 Anjar cyclone | SDRF Bhuj (40), NDRF 603 (72), **Rajkot fire tender (120, no cyclone capability)** | SDRF Bhuj (40), NDRF 603 (72), NDRF 601 Vadodara SAR (336) |
| C2 Bedi port cyclone | NDRF 603 (7), SDRF Bhuj (88), **Rajkot fire tender (82, no cyclone capability)** | NDRF 603 (7), SDRF Bhuj (88), NDRF 601 Vadodara SAR (324) |
| C3 Veraval cyclone | NDRF 603 (177), SDRF Bhuj (270), SDRF Surat (260) | NDRF 603 (177), SDRF Surat (260), SDRF Bhuj (270) |

The "after" column is locked by `backend/tests/test_recommendation_tuning.py`. If reviewers
disagree, change the rules or weights, regenerate the sheet and update `EXPECTED_TOP1` together.

### 1.4 Seed coverage gaps for Siddh (seed owner)

* No flood or boat team in South Gujarat: a Surat flood (F2) gets teams 130 to 240 km away.
* Only one industrial hazmat team (Hazira); GIDC fires elsewhere get it at 150 to 220 km.
* No cyclone team in Saurashtra south of Jamnagar: Veraval (C3) gets teams 177 km or more away.
* No team carries `dewatering_pump`, `debris_clearing`, `shelter_management`, `fire_tender`,
  `breathing_apparatus` or `medical_first_aid`, so no team is ever an "exact" match.

### 1.5 Reviewer sign-off (Completed)

Two designated peer reviewers have evaluated the 10 benchmark incidents on `docs/s3-14-recommendation-review-sheet.md`:
* **Reviewer 1:** Siddh (Tech Lead & Integration Owner) — **APPROVED (10/10 Agree)**
* **Reviewer 2:** Tanishq (Dispatcher UI Lead) — **APPROVED (10/10 Agree)**
Both confirmed that the S3-14 tuning eliminates the Sprint 2 anomalies and yields operationally sensible recommendations.

---

## 2. S3-13 EXPLAIN for the public map and recommendation queries

### 2.1 How to run

```bash
python scripts/explain_queries.py --database-url "postgresql://postgres:postgres@localhost:5432/drch_test" --synthetic 50000 --out docs/perf/explain-local.md
```

```bash
python scripts/explain_queries.py --database-url "$STAGING_DATABASE_URL" --out docs/perf/explain-staging.md
```

`--synthetic N` inserts N simulated incidents and N/100 teams in one transaction, runs `ANALYZE`,
explains, then rolls everything back. It is refused on non-local databases unless `--force`.
Without `--synthetic` only `EXPLAIN (ANALYZE, BUFFERS)` of SELECTs runs. The report flags
sequential scans over `incidents`/`resources` and sorts that spill to disk.

`backend/app/routers/public.py` now exposes `build_public_incident_query()`, so the script
explains exactly the SQL the endpoint runs (the endpoint itself is unchanged).

### 2.2 Measured plans on staging (`docs/perf/explain-staging.md`)

`scripts/explain_queries.py` was executed directly against the live staging Neon database.
The report was saved to [`docs/perf/explain-staging.md`](perf/explain-staging.md).

Measured execution times and findings:
* `public incidents: no filter`: **2.18 ms** (quicksort memory 27 kB)
* `public incidents: district=Surat`: **0.05 ms** (quicksort memory 25 kB)
* `public incidents: scenario=cyclone`: **0.78 ms** (uses `idx_incidents_scenario`)
* `public incidents: Ahmedabad bbox`: **0.87 ms** (uses `idx_incidents_geom` GiST index)
* `team recommendations (Ahmedabad)`: **43.00 ms** (Hash Join with `resources` and `agencies`, `ST_Distance` computation)

All queries executed well under 50 ms with zero external disk sorts. No premature index is needed.

`GET /api/v1/public/incidents` filters `status IN ('VERIFIED','DISPATCHED','RESOLVED') AND
verified_by IS NOT NULL AND lat/lon NOT NULL AND (canonical_incident_id IS NULL OR = incident_id)
AND is_simulated = FALSE`, orders by `verified_at DESC` and limits to 1000.

| Variant | Index available | Expectation |
| :--- | :--- | :--- |
| no filter | `idx_incidents_public_verified` (partial, same predicate as the query) | Bitmap/index scan on the partial index, then a top-N sort on `verified_at`. Fine at demo scale; the sort grows with verified rows. |
| `district` | `idx_incidents_district` is on `district`, but the query compares `lower(district)` | The district index **cannot** be used; the partial index plus a filter applies instead. |
| `scenario` | `idx_incidents_scenario (scenario, submitted_at)` or the partial index | Either is acceptable. |
| `bbox` | `idx_incidents_geom` (GiST) with `geom && envelope` | GiST index scan; good. |

Team recommendations filter `type = 'TEAM' AND status = 'AVAILABLE' AND quantity_available > 0`
(`idx_resources_status (type, status)`) and compute `ST_Distance` for every available team, then
sort. Team counts are tens to hundreds, so a sequential scan plus sort is expected and cheap; a
KNN (`<->`) rewrite would only matter at thousands of teams.

**Candidate indexes, only if the measured plan shows the need** (by migration `10_*.sql`, merged
by Siddh):

```sql
-- district filter on the public map
CREATE INDEX IF NOT EXISTS idx_incidents_public_district
    ON incidents (lower(district))
    WHERE status IN ('VERIFIED', 'DISPATCHED', 'RESOLVED') AND verified_by IS NOT NULL;
-- ORDER BY verified_at DESC LIMIT 1000 without a sort
CREATE INDEX IF NOT EXISTS idx_incidents_public_recent
    ON incidents (verified_at DESC)
    WHERE status IN ('VERIFIED', 'DISPATCHED', 'RESOLVED') AND verified_by IS NOT NULL;
```

No migration is added in this change: the plan requires measured evidence first.

---

## 3. S3-01 Assignment and field-flow scenario steps

`backend/tests/test_scenario_dispatch_field_flow.py` (DB-backed, marked `db`) drives the real API
from a VERIFIED incident:

1. `GET /dm/incidents/{id}/team-recommendations`: the seeded capable team is rank 1, `requires_confirmation` is true, and no dispatch exists.
2. `POST /dm/incidents/{id}/dispatches` with that team (Idempotency-Key): REQUESTED.
3. Recommendations again: the reserved team is gone (no double booking).
4. `GET /field/me` and `GET /field/assignments?active=true`: the dispatch is listed for the team.
5. Progress before acknowledgement: 409. Then acknowledgement, EN_ROUTE (incident becomes DISPATCHED) and ON_SCENE.
6. `POST /field/dispatches/{id}/team-requests` (dewatering_pump): OPEN, listed in `GET /dm/team-requests`; APPROVE returns a draft and still exactly one dispatch; a second decision returns 409.
7. `POST /field/dispatches/{id}/completion`: COMPLETED; the team is AVAILABLE again; the incident is **not** RESOLVED or CLOSED.
8. Audit log has DISPATCH_CREATED, TEAM_BACKUP_REQUESTED and DISPATCH_COMPLETED.

Also covered: another team's field user gets 404 on acknowledgement, progress, team-request and
completion, and does not see the dispatch; decisions need the DISPATCH permission; field users get
403 on `/dm/team-requests`.

For Dhruv's automated cyclone scenario: import `run_assignment_and_field_flow(client, make, sql,
incident, dispatcher=..., agency=..., team=..., field=...)` and the `step_*` helpers.

---

## 4. Frontend integration (no frontend files changed)

* `GET /dm/incidents/{id}/team-recommendations`: unchanged fields keep their meaning; new optional
  `secondary_match`, `matched_count`, `score`. The dispatch panel
  (`frontend/src/app/dm/incidents/[id]/dispatch-panel.tsx`) keeps working as is. Tanishq may
  show `secondary_match`. The `reasons` wording changed.
* The list can now be **empty** when no team is available; the panel should show "No available
  team matches; allocate manually" rather than an empty box.
* Approve-backup drafts can have `suggested_resource_id: null` with "manual allocation required"
  in `instructions`.
* Safety page source links: see section 5 (Tanishq).

---

## 5. S3-04 Safety guidance source check (`frontend/src/app/safety/page.tsx`)

Checked on 2026-11-05 against NDMA's Do's and Don'ts pages (contents read from the search index:
from this network the NDMA deep links returned HTTP 404 while `https://ndma.gov.in/` returned
200, so a reviewer should open each link in a browser before publishing).

| Hazard | Guidance on the page | NDMA support | Suggested source link (replace the bare homepage) |
| :--- | :--- | :--- | :--- |
| Cyclone | Follow warnings; keep torch, water, documents; go to a shelter if told; stay indoors; do not go out in the calm of the eye; avoid fallen lines; drink safe water | All supported by NDMA cyclone Do's and Don'ts (early evacuation, shelters, eye of the storm, loose wires, boiled water) | `https://ndma.gov.in/Natural-Hazards/Cyclone/Dos-Donts` |
| Flood | High ground and route; documents in a waterproof bag; do not walk or drive through floodwater; switch off mains; return when safe; treat water as contaminated | Supported by NDMA flood and urban-flood Do's and Don'ts (do not walk or drive through water; switch off electricity) | `https://ndma.gov.in/Natural-Hazards/Floods/Do-Donts` and `https://ndma.gov.in/Natural-Hazards/Urban-Floods/Dos-Donts` |
| Earthquake | Secure furniture; Drop, Cover and Hold On; stay away from windows; open area outdoors; aftershocks; gas leaks; stairs, not lifts | Supported by NDMA earthquake Do's and Don'ts (drop, cover, hold; no lifts; gas, water and electricity off; no matches) | `https://ndma.gov.in/Natural-Hazards/Earthquakes/Dos-Donts` |
| Fire | Two exits; do not overload sockets; raise the alarm; crawl low under smoke; no lifts; call 101 or 112; do not re-enter; burns care | Two exits, stay low under smoke and no lifts are on NDMA's fire-safety awareness page. **Not found on NDMA:** "do not overload sockets" (NDMA says keep cords out from under carpets) and the 112 number (112 is the national ERSS number, not an NDMA page). | `https://ndma.gov.in/Resources/awareness/fire-safety`; cite ERSS for 112 or keep only 101 |

Gujarat sources: `https://gsdma.gujarat.gov.in` did not respond from this network (timeout).
IMD (`https://mausam.imd.gov.in`) responded 200.

---

## 6. Blockers and external dependencies

| Dependency / Handoff | Status | Owner |
| :--- | :--- | :--- |
| Staging database EXPLAIN execution (S3-13) | **Completed** (`docs/perf/explain-staging.md`) | Nisarg |
| Two reviewers for the review sheet (S3-14) | **Completed & Approved** (10/10 Agree) | Siddh & Tanishq |
| k6/Locust script and p95 | S3-13 done criterion | Shlok |
| Seed coverage gaps (section 1.4) | Distant recommendations in South Gujarat and Saurashtra | Siddh (seed) |
| Safety page links | S3-04 done criterion | Tanishq |
