-- Migration 003: Incidents, Locations, Evidence, Verification, AI Triage & Prioritization
-- Traceability: NU-FR-03..06, DM-FR-02..06, DM-NFR-09/10/11, EH-01/03/04/05/06/12

CREATE TABLE incidents (
    incident_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_ref     VARCHAR(30) UNIQUE NOT NULL,
    reporter_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    scenario         scenario_type NOT NULL,
    description      TEXT NOT NULL,
    reported_urgency priority_level,
    people_affected  INT CHECK (people_affected >= 0),
    status           incident_status NOT NULL DEFAULT 'SUBMITTED',
    verified_priority priority_level,
    priority_rationale TEXT,
    canonical_incident_id UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    idempotency_key  VARCHAR(100),
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at        TIMESTAMPTZ,
    version          INT NOT NULL DEFAULT 1,
    UNIQUE (reporter_id, idempotency_key),
    CHECK (status NOT IN ('VERIFIED', 'DISPATCHED', 'RESOLVED') OR verified_priority IS NOT NULL),
    CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
);
CREATE INDEX idx_incidents_status_prio ON incidents(status, verified_priority);
CREATE INDEX idx_incidents_scenario    ON incidents(scenario, submitted_at DESC);
CREATE INDEX idx_incidents_reporter    ON incidents(reporter_id, submitted_at DESC);

CREATE TABLE incident_locations (
    location_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    source        location_source NOT NULL,
    latitude      NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    longitude     NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    geom          GEOGRAPHY(Point,4326),
    accuracy_m    NUMERIC(8,2),
    address_text  TEXT,
    landmark      TEXT,
    normalised_address TEXT,
    is_current    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (geom IS NOT NULL OR address_text IS NOT NULL),
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);
CREATE INDEX idx_incident_loc_geom ON incident_locations USING GIST (geom);
CREATE INDEX idx_incident_loc_inc  ON incident_locations(incident_id) WHERE is_current;

CREATE TABLE incident_details (
    incident_id   UUID PRIMARY KEY REFERENCES incidents(incident_id) ON DELETE CASCADE,
    details       JSONB NOT NULL DEFAULT '{}'::jsonb,
    schema_version INT NOT NULL DEFAULT 1
);

CREATE TABLE incident_status_history (
    history_id   BIGSERIAL PRIMARY KEY,
    incident_id  UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    from_status  incident_status,
    to_status    incident_status NOT NULL,
    changed_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reason       TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inc_hist ON incident_status_history(incident_id, changed_at);

CREATE TABLE evidence_files (
    evidence_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    uploaded_by   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    file_name     VARCHAR(255) NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_key   TEXT NOT NULL,
    sha256        CHAR(64) NOT NULL,
    scan_state    scan_status NOT NULL DEFAULT 'PENDING',
    scan_detail   TEXT,
    moderation_flag BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_incident ON evidence_files(incident_id);
CREATE INDEX idx_evidence_scan ON evidence_files(scan_state);

CREATE TABLE verification_decisions (
    decision_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE RESTRICT,
    decided_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    decision      verification_decision NOT NULL,
    rationale     TEXT NOT NULL,
    info_requested TEXT,
    decided_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verif_incident ON verification_decisions(incident_id, decided_at DESC);

CREATE TABLE ai_models (
    model_id     SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    version      VARCHAR(50) NOT NULL,
    provider     VARCHAR(100),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (name, version)
);

CREATE TABLE ai_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    model_id        INT REFERENCES ai_models(model_id),
    requested_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    status          ai_rec_status NOT NULL,
    suggested_scenario scenario_type,
    suggested_priority priority_level,
    confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    uncertainty_note TEXT,
    factors         JSONB,
    guardrail_result JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_rec_incident ON ai_recommendations(incident_id, created_at DESC);

CREATE TABLE ai_human_decisions (
    ai_decision_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES ai_recommendations(recommendation_id) ON DELETE CASCADE,
    incident_id     UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    decided_by      UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    action          ai_decision_action NOT NULL,
    final_scenario  scenario_type,
    final_priority  priority_level,
    rationale       TEXT,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE priority_assignments (
    priority_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    priority        priority_level NOT NULL,
    assigned_by     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    rationale       TEXT NOT NULL,
    based_on_ai_recommendation UUID REFERENCES ai_recommendations(recommendation_id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prio_incident ON priority_assignments(incident_id, assigned_at DESC);

CREATE TABLE incident_duplicate_links (
    link_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_a   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    incident_b   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    similarity   NUMERIC(4,3),
    match_basis  JSONB,
    detected_by  VARCHAR(20) NOT NULL,
    relation     duplicate_relation NOT NULL DEFAULT 'CANDIDATE',
    reviewed_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (incident_a < incident_b),
    UNIQUE (incident_a, incident_b)
);
