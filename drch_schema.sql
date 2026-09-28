-- =====================================================================
-- Disaster Response Coordination Hub (DRCH) - IT314 Software Engineering
-- PostgreSQL 15+ / PostGIS Database Schema
--
-- Direct traceability to Final SRS:
--   * Scenarios strictly limited to: Cyclone, Industrial Fire, Urban Flooding
--   * Core Principles: Human Oversight, State Transparency, No False Success,
--     Auditability (tamper-evident hash chain), Least Privilege (RBAC)
--   * FRs: NU-FR-01..10, DM-FR-01..14, AM-FR-01..10
--   * NFRs: Usability, Accessibility, Performance, Availability, Privacy,
--     Security, Transaction Reliability, Explainability, Data Integrity
--   * Error Handling: EH-01..14 with explicit failure states and idempotency
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS postgis;    -- spatial geography types and indexes
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive emails & text

-- ---------------------------------------------------------------------
-- 0. ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE role_code            AS ENUM ('NORMAL_USER', 'DISASTER_MGMT', 'APP_MGMT');
CREATE TYPE account_status       AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED', 'PENDING_VERIFICATION');
CREATE TYPE scenario_type        AS ENUM ('CYCLONE', 'INDUSTRIAL_FIRE', 'URBAN_FLOODING');
CREATE TYPE incident_status      AS ENUM ('SUBMITTED', 'NEEDS_INFORMATION', 'VERIFIED', 'DISPATCHED', 'RESOLVED', 'CLOSED', 'REJECTED');
CREATE TYPE verification_decision AS ENUM ('VERIFIED', 'REJECTED', 'NEEDS_INFORMATION');
CREATE TYPE priority_level       AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE location_source      AS ENUM ('GPS', 'MAP_PIN', 'MANUAL');
CREATE TYPE scan_status          AS ENUM ('PENDING', 'CLEAN', 'QUARANTINED', 'REJECTED', 'FAILED');
CREATE TYPE ai_decision_action   AS ENUM ('ACCEPTED', 'MODIFIED', 'REJECTED');
CREATE TYPE ai_rec_status        AS ENUM ('GENERATED', 'LOW_CONFIDENCE', 'UNAVAILABLE', 'UNSAFE_OUTPUT');
CREATE TYPE duplicate_relation   AS ENUM ('CANDIDATE', 'CONFIRMED_DUPLICATE', 'LINKED', 'MERGED', 'NOT_DUPLICATE');
CREATE TYPE txn_status           AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');
CREATE TYPE recon_status         AS ENUM ('UNRECONCILED', 'MATCHED', 'MISMATCH', 'HELD', 'RESOLVED');
CREATE TYPE aid_status           AS ENUM ('REGISTERED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED',
                                          'ALLOCATED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'WITHDRAWN');
CREATE TYPE delivery_status      AS ENUM ('CREATED', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE resource_type        AS ENUM ('TEAM', 'VEHICLE', 'SUPPLY', 'SUPPORT');
CREATE TYPE resource_status      AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'UNAVAILABLE', 'MAINTENANCE');
CREATE TYPE dispatch_status      AS ENUM ('REQUESTED', 'TRANSMITTED', 'ACKNOWLEDGED', 'DISPATCHED',
                                          'REJECTED', 'FAILED', 'CANCELLED', 'COMPLETED');
CREATE TYPE msg_status           AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'FAILED');
CREATE TYPE notif_channel        AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');
CREATE TYPE notif_status         AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'SUPPRESSED');
CREATE TYPE content_status       AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'RETIRED');
CREATE TYPE audit_result         AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');
CREATE TYPE health_state         AS ENUM ('UP', 'DEGRADED', 'DOWN', 'UNKNOWN');
CREATE TYPE backup_status        AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'VERIFIED', 'CORRUPT');
CREATE TYPE campaign_status      AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

-- ---------------------------------------------------------------------
-- 1. IDENTITY, ROLES, SESSIONS & RBAC (NU-FR-01/02, DM-FR-01, AM-FR-01/02, EH-02)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_id      SMALLSERIAL PRIMARY KEY,
    code         role_code UNIQUE NOT NULL,
    description  TEXT
);

CREATE TABLE permissions (
    permission_id SERIAL PRIMARY KEY,
    code          VARCHAR(80) UNIQUE NOT NULL,      -- e.g. INCIDENT_VERIFY, DISPATCH_CREATE
    description   TEXT
);

CREATE TABLE role_permissions (
    role_id       SMALLINT REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id        SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    email          CITEXT UNIQUE NOT NULL,
    phone          VARCHAR(20),
    password_hash  TEXT NOT NULL,                   -- argon2id / bcrypt hash only
    status         account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,  -- mandatory for staff & admin roles
    consent_given_at TIMESTAMPTZ,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ                      -- soft deletion for audit integrity
);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_status ON users(status);

-- Agencies defined before user_profiles to allow clean foreign key referencing
CREATE TABLE agencies (
    agency_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(200) NOT NULL,
    agency_type  VARCHAR(50) NOT NULL,               -- FIRE, POLICE, NDRF, MEDICAL, MUNICIPAL, NGO
    contact_email CITEXT,
    contact_phone VARCHAR(20),
    api_endpoint TEXT,                               -- trusted integration endpoint
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
    user_id      UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    full_name    VARCHAR(150) NOT NULL,
    address_line TEXT,
    city         VARCHAR(100),
    state        VARCHAR(100),
    postal_code  VARCHAR(12),
    preferred_language VARCHAR(10) DEFAULT 'en',
    staff_agency_id UUID REFERENCES agencies(agency_id) ON DELETE SET NULL,
    staff_designation VARCHAR(100),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mfa_factors (
    mfa_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    factor_type VARCHAR(20) NOT NULL,                -- TOTP, SMS, HARDWARE
    secret_enc  BYTEA NOT NULL,                      -- encrypted at rest
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL,
    ip_address   INET,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ
);
CREATE INDEX idx_sessions_user ON user_sessions(user_id, expires_at);

CREATE TABLE login_attempts (                        -- EH-02 rate limiting, brute force prevention, no account enumeration
    attempt_id   BIGSERIAL PRIMARY KEY,
    email_tried  CITEXT,
    user_id      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    success      BOOLEAN NOT NULL,
    ip_address   INET,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_email ON login_attempts(email_tried, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, attempted_at DESC);

-- ---------------------------------------------------------------------
-- 2. INCIDENTS, EVIDENCE & LOCATION (NU-FR-03/04/05/06, DM-FR-02, 7.1, 13.1, 13.2)
-- ---------------------------------------------------------------------
CREATE TABLE incidents (
    incident_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_ref     VARCHAR(30) UNIQUE NOT NULL,     -- human-readable ID, e.g. INC-2026-000123
    reporter_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    scenario         scenario_type NOT NULL,          -- Cyclone, Industrial Fire, Urban Flooding only
    description      TEXT NOT NULL,
    reported_urgency priority_level,                  -- citizen-declared, advisory only
    people_affected  INT CHECK (people_affected >= 0),
    status           incident_status NOT NULL DEFAULT 'SUBMITTED',
    verified_priority priority_level,                 -- operational priority set by authorized staff (DM-FR-06)
    priority_rationale TEXT,
    canonical_incident_id UUID REFERENCES incidents(incident_id) ON DELETE SET NULL, -- duplicate cluster root
    idempotency_key  VARCHAR(100),                    -- EH-12: safe retry without creating duplicate incident
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at        TIMESTAMPTZ,
    version          INT NOT NULL DEFAULT 1,          -- optimistic locking for concurrent triage (DM-NFR-11)
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
    is_current    BOOLEAN NOT NULL DEFAULT TRUE,      -- supports location refinement while preserving history
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (geom IS NOT NULL OR address_text IS NOT NULL),
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);
CREATE INDEX idx_incident_loc_geom ON incident_locations USING GIST (geom);
CREATE INDEX idx_incident_loc_inc  ON incident_locations(incident_id) WHERE is_current;

-- Scenario-specific captured details (Cyclone / Fire / Flooding) stored with schema versioning
CREATE TABLE incident_details (
    incident_id   UUID PRIMARY KEY REFERENCES incidents(incident_id) ON DELETE CASCADE,
    -- Cyclone: {"severity": "...", "shelter_needed": true, "affected_area_sqkm": ...}
    -- Industrial Fire: {"site_type": "...", "smoke_color": "...", "chemical_involved": false, "injuries": 0, "access_blocked": false}
    -- Urban Flooding: {"water_level_feet": ..., "stranded_count": ..., "road_passable": false}
    details       JSONB NOT NULL DEFAULT '{}'::jsonb,
    schema_version INT NOT NULL DEFAULT 1
);

CREATE TABLE incident_status_history (               -- NU-FR-06: state transparency & timeline
    history_id   BIGSERIAL PRIMARY KEY,
    incident_id  UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    from_status  incident_status,
    to_status    incident_status NOT NULL,
    changed_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,  -- NULL = system
    reason       TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inc_hist ON incident_status_history(incident_id, changed_at);

CREATE TABLE evidence_files (                        -- NU-FR-05, EH-03
    evidence_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    uploaded_by   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    file_name     VARCHAR(255) NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_key   TEXT NOT NULL,                      -- object store S3/GCS URI
    sha256        CHAR(64) NOT NULL,
    scan_state    scan_status NOT NULL DEFAULT 'PENDING',
    scan_detail   TEXT,
    moderation_flag BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_incident ON evidence_files(incident_id);
CREATE INDEX idx_evidence_scan ON evidence_files(scan_state);

-- ---------------------------------------------------------------------
-- 3. VERIFICATION, DUPLICATES, AI TRIAGE & PRIORITY (DM-FR-03..06, 7.2, 13.2)
-- ---------------------------------------------------------------------
CREATE TABLE verification_decisions (                -- auditable verification decisions (DM-FR-03)
    decision_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE RESTRICT,
    decided_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    decision      verification_decision NOT NULL,
    rationale     TEXT NOT NULL,
    info_requested TEXT,                              -- populated when NEEDS_INFORMATION
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

CREATE TABLE ai_recommendations (                    -- advisory only; stored separately from human decisions
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    model_id        INT REFERENCES ai_models(model_id),
    requested_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    status          ai_rec_status NOT NULL,
    suggested_scenario scenario_type,
    suggested_priority priority_level,
    confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    uncertainty_note TEXT,
    factors         JSONB,                            -- explainable AI features (DM-NFR-09)
    guardrail_result JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_rec_incident ON ai_recommendations(incident_id, created_at DESC);

CREATE TABLE ai_human_decisions (                    -- human final call on advisory AI outputs (DM-NFR-10)
    ai_decision_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES ai_recommendations(recommendation_id) ON DELETE CASCADE,
    incident_id     UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    decided_by      UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT, -- human operator
    action          ai_decision_action NOT NULL,
    final_scenario  scenario_type,
    final_priority  priority_level,
    rationale       TEXT,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE priority_assignments (                  -- DM-FR-06: full history of priority assignments
    priority_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    priority        priority_level NOT NULL,
    assigned_by     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    rationale       TEXT NOT NULL,
    based_on_ai_recommendation UUID REFERENCES ai_recommendations(recommendation_id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prio_incident ON priority_assignments(incident_id, assigned_at DESC);

CREATE TABLE incident_duplicate_links (              -- DM-FR-04, EH-04: candidate duplicates without auto-delete
    link_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_a   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    incident_b   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    similarity   NUMERIC(4,3),
    match_basis  JSONB,                               -- text, spatial, temporal, evidence similarity scores
    detected_by  VARCHAR(20) NOT NULL,                -- RULES | AI
    relation     duplicate_relation NOT NULL DEFAULT 'CANDIDATE',
    reviewed_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (incident_a < incident_b),                 -- canonical ordering prevents inverse duplicates (A,B)/(B,A)
    UNIQUE (incident_a, incident_b)
);

-- ---------------------------------------------------------------------
-- 4. RESOURCES & EMERGENCY DISPATCH (DM-FR-07/08/09/10, 7.5, 13.5)
-- ---------------------------------------------------------------------
CREATE TABLE resources (
    resource_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id     UUID REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    type          resource_type NOT NULL,
    name          VARCHAR(150) NOT NULL,
    capability    JSONB,                               -- e.g. {"boat": true, "capacity": 12, "high_clearance": true}
    status        resource_status NOT NULL DEFAULT 'AVAILABLE',
    home_geom     GEOGRAPHY(Point,4326),
    current_geom  GEOGRAPHY(Point,4326),
    location_updated_at TIMESTAMPTZ,
    quantity_total NUMERIC(12,2),                       -- pool quantity for SUPPLY types
    quantity_available NUMERIC(12,2),
    version       INT NOT NULL DEFAULT 1,               -- optimistic locking to prevent double-booking (DM-NFR-11)
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_available IS NULL OR quantity_available >= 0),
    CHECK (quantity_total IS NULL OR quantity_available <= quantity_total)
);
CREATE INDEX idx_resources_status ON resources(type, status);
CREATE INDEX idx_resources_geom ON resources USING GIST (current_geom);

CREATE TABLE dispatch_orders (
    dispatch_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_ref  VARCHAR(30) UNIQUE NOT NULL,         -- e.g. DISP-2026-000456
    incident_id   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE RESTRICT,
    created_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    receiving_agency_id UUID REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    status        dispatch_status NOT NULL DEFAULT 'REQUESTED',
    instructions  TEXT,
    priority      priority_level NOT NULL,
    acknowledged_by TEXT,                              -- operational receiver endpoint / contact
    acknowledged_at TIMESTAMPTZ,
    failure_reason TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Core Principle: State advances only on confirmation (No false success)
    CHECK (status NOT IN ('ACKNOWLEDGED', 'DISPATCHED', 'COMPLETED') OR (acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL)),
    CHECK (status NOT IN ('FAILED', 'REJECTED') OR failure_reason IS NOT NULL)
);
CREATE INDEX idx_dispatch_incident ON dispatch_orders(incident_id);
CREATE INDEX idx_dispatch_status   ON dispatch_orders(status);

CREATE TABLE resource_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id   UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    resource_id   UUID NOT NULL REFERENCES resources(resource_id) ON DELETE RESTRICT,
    quantity      NUMERIC(12,2) DEFAULT 1,
    assigned_by   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at   TIMESTAMPTZ,
    release_reason TEXT
);
CREATE INDEX idx_assignments_active ON resource_assignments(resource_id) WHERE released_at IS NULL;

CREATE TABLE dispatch_events (                        -- explicit state transitions only on confirmed event
    event_id     BIGSERIAL PRIMARY KEY,
    dispatch_id  UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    from_status  dispatch_status,
    to_status    dispatch_status NOT NULL,
    source       VARCHAR(50) NOT NULL,                -- OPERATOR | AGENCY_API | SYSTEM
    actor_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    payload      JSONB,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_events ON dispatch_events(dispatch_id, occurred_at);

CREATE TABLE agency_messages (                        -- DM-FR-10: Inter-agency communication
    message_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    incident_id  UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    dispatch_id  UUID REFERENCES dispatch_orders(dispatch_id) ON DELETE SET NULL,
    subject      VARCHAR(200),
    body         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agency_message_recipients (
    message_id   UUID REFERENCES agency_messages(message_id) ON DELETE CASCADE,
    agency_id    UUID REFERENCES agencies(agency_id) ON DELETE CASCADE,
    status       msg_status NOT NULL DEFAULT 'QUEUED',
    acknowledged_at TIMESTAMPTZ,
    failure_reason TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, agency_id)
);

CREATE TABLE map_layers (                             -- DM-FR-07: GIS overlay layers
    layer_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    layer_type   VARCHAR(50) NOT NULL,                -- AFFECTED_AREA, EVACUATION_ROUTE, SHELTER, HAZARD_ZONE
    scenario     scenario_type,
    geom         GEOGRAPHY(Geometry, 4326),
    properties   JSONB,
    source       VARCHAR(100),
    valid_from   TIMESTAMPTZ,
    valid_to     TIMESTAMPTZ,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_map_layers_geom ON map_layers USING GIST (geom);

-- ---------------------------------------------------------------------
-- 5. PUBLIC CONTENT & VERIFIED UPDATES (NU-FR-08, DM-FR-11)
-- ---------------------------------------------------------------------
CREATE TABLE safety_content (
    content_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario     scenario_type NOT NULL,
    title        VARCHAR(200) NOT NULL,
    body         TEXT NOT NULL,
    language     VARCHAR(10) NOT NULL DEFAULT 'en',
    version      INT NOT NULL DEFAULT 1,
    status       content_status NOT NULL DEFAULT 'DRAFT',
    source_name  VARCHAR(200),
    approved_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scenario, title, language, version)
);

CREATE TABLE public_updates (
    update_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id  UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    scenario     scenario_type,
    title        VARCHAR(200) NOT NULL,
    body         TEXT NOT NULL,
    affected_area GEOGRAPHY(Geometry, 4326),
    area_label   VARCHAR(200),
    version      INT NOT NULL DEFAULT 1,
    supersedes_id UUID REFERENCES public_updates(update_id) ON DELETE SET NULL,
    status       content_status NOT NULL DEFAULT 'DRAFT',
    published_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    send_notification BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_public_updates_pub ON public_updates(status, published_at DESC);

-- ---------------------------------------------------------------------
-- 6. MONETARY DONATIONS (NU-FR-09, DM-FR-12, AM-FR-10, NU-NFR-07/08/10, 7.3, 13.3)
-- ---------------------------------------------------------------------
CREATE TABLE donation_campaigns (
    campaign_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(200) NOT NULL,
    purpose      TEXT NOT NULL,
    scenario     scenario_type,
    target_amount NUMERIC(14,2),
    currency     CHAR(3) NOT NULL DEFAULT 'INR',
    status       campaign_status NOT NULL DEFAULT 'DRAFT',
    approved_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    starts_at    TIMESTAMPTZ,
    ends_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE donations (
    donation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID NOT NULL REFERENCES donation_campaigns(campaign_id) ON DELETE RESTRICT,
    donor_id     UUID REFERENCES users(user_id) ON DELETE SET NULL, -- independent entry point; guest donor allowed
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency     CHAR(3) NOT NULL DEFAULT 'INR',
    status       txn_status NOT NULL DEFAULT 'PENDING',
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,          -- NU-NFR-10: donor privacy
    donor_name   VARCHAR(150),
    donor_email  CITEXT,
    gateway_name VARCHAR(50),
    gateway_order_id VARCHAR(100),
    gateway_txn_ref  VARCHAR(100),                         -- populated ONLY after gateway confirmation
    payment_method_type VARCHAR(30),                       -- UPI/CARD/NETBANKING (Never store card credentials - NU-NFR-07)
    failure_code VARCHAR(50),
    failure_message TEXT,
    recon_state  recon_status NOT NULL DEFAULT 'UNRECONCILED',
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,          -- prevents duplicate charges on network retry
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (gateway_name, gateway_txn_ref),
    CHECK (status <> 'CONFIRMED' OR (gateway_txn_ref IS NOT NULL AND confirmed_at IS NOT NULL))
);
CREATE INDEX idx_donations_status ON donations(status, created_at DESC);
CREATE INDEX idx_donations_campaign ON donations(campaign_id, status);
CREATE INDEX idx_donations_donor ON donations(donor_id);

CREATE TABLE payment_callbacks (                          -- immutable raw signed callbacks for reconciliation
    callback_id  BIGSERIAL PRIMARY KEY,
    donation_id  UUID REFERENCES donations(donation_id) ON DELETE CASCADE,
    gateway_name VARCHAR(50) NOT NULL,
    event_type   VARCHAR(60),
    signature_valid BOOLEAN NOT NULL,
    payload      JSONB NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    process_result VARCHAR(30)                             -- APPLIED | IGNORED_DUPLICATE | REJECTED
);
CREATE INDEX idx_callbacks_donation ON payment_callbacks(donation_id);

CREATE TABLE donation_status_history (
    history_id   BIGSERIAL PRIMARY KEY,
    donation_id  UUID NOT NULL REFERENCES donations(donation_id) ON DELETE CASCADE,
    from_status  txn_status,
    to_status    txn_status NOT NULL,
    reason       TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reconciliation_records (                     -- AM-FR-10: Gateway reconciliation
    recon_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id  UUID REFERENCES donations(donation_id) ON DELETE RESTRICT,
    gateway_amount NUMERIC(14,2),
    app_amount   NUMERIC(14,2),
    result       recon_status NOT NULL,
    mismatch_detail TEXT,
    run_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at  TIMESTAMPTZ
);

CREATE TABLE receipts (                                   -- issued ONLY for CONFIRMED donations
    receipt_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id  UUID UNIQUE NOT NULL REFERENCES donations(donation_id) ON DELETE RESTRICT,
    receipt_no   VARCHAR(40) UNIQUE NOT NULL,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    document_key TEXT
);

CREATE TABLE fund_utilisations (                           -- DM-FR-12: Full audit trail of relief fund utilization
    utilisation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID NOT NULL REFERENCES donation_campaigns(campaign_id) ON DELETE RESTRICT,
    incident_id  UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    purpose      TEXT NOT NULL,
    approved_by  UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 7. PHYSICAL AID (NU-FR-10, DM-FR-12/13, 7.4, 13.4)
-- ---------------------------------------------------------------------
CREATE TABLE aid_needs (                                  -- verified disaster needs that aid is mapped to
    need_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id  UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    campaign_id  UUID REFERENCES donation_campaigns(campaign_id) ON DELETE SET NULL,
    aid_type     VARCHAR(80) NOT NULL,
    quantity_required NUMERIC(12,2) NOT NULL CHECK (quantity_required > 0),
    quantity_fulfilled NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit         VARCHAR(30) NOT NULL,
    delivery_geom GEOGRAPHY(Point,4326),
    delivery_address TEXT,
    needed_by    TIMESTAMPTZ,
    approved_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    is_open      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_fulfilled <= quantity_required)
);

CREATE TABLE aid_contributions (                          -- citizen contribution independently of incident
    contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    aid_type        VARCHAR(80) NOT NULL,
    description     TEXT,
    quantity        NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit            VARCHAR(30) NOT NULL,
    condition_desc  VARCHAR(100),                          -- e.g. sealed, new, undamaged
    expiry_date     DATE,
    pickup_address  TEXT,
    pickup_geom     GEOGRAPHY(Point,4326),
    contact_phone   VARCHAR(20),
    available_from  TIMESTAMPTZ,
    available_until TIMESTAMPTZ,
    status          aid_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aid_status ON aid_contributions(status);
CREATE INDEX idx_aid_contributor ON aid_contributions(contributor_id);

CREATE TABLE aid_allocations (                            -- match verified aid to approved need
    allocation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_id UUID NOT NULL REFERENCES aid_contributions(contribution_id) ON DELETE RESTRICT,
    need_id         UUID NOT NULL REFERENCES aid_needs(need_id) ON DELETE RESTRICT,
    quantity        NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    allocated_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status          aid_status NOT NULL DEFAULT 'ALLOCATED',
    allocated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delivery_tasks (                             -- tracking delivery with confirmed receipt
    delivery_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id  UUID NOT NULL REFERENCES aid_allocations(allocation_id) ON DELETE RESTRICT,
    assigned_resource_id UUID REFERENCES resources(resource_id) ON DELETE SET NULL,
    status         delivery_status NOT NULL DEFAULT 'CREATED',
    scheduled_pickup TIMESTAMPTZ,
    picked_up_at   TIMESTAMPTZ,
    delivered_at   TIMESTAMPTZ,
    received_by    VARCHAR(150),                            -- recipient acknowledgment name
    confirmed_by   UUID REFERENCES users(user_id) ON DELETE SET NULL, -- authorised operator confirmation
    failure_reason TEXT,
    attempt_no     INT NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
    CHECK (status <> 'DELIVERED' OR (delivered_at IS NOT NULL AND confirmed_by IS NOT NULL))
);

CREATE TABLE delivery_events (
    event_id    BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES delivery_tasks(delivery_id) ON DELETE CASCADE,
    status      delivery_status NOT NULL,
    note        TEXT,
    actor_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. NOTIFICATIONS & PREFERENCES (NU-FR-07, AM-FR-09, EH-13, AM-NFR-08)
-- ---------------------------------------------------------------------
CREATE TABLE notification_templates (
    template_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(80) NOT NULL,                       -- INCIDENT_SUBMITTED, DONATION_CONFIRMED, etc.
    channel      notif_channel NOT NULL,
    language     VARCHAR(10) NOT NULL DEFAULT 'en',
    subject      VARCHAR(200),
    body         TEXT NOT NULL,
    version      INT NOT NULL DEFAULT 1,
    is_active    BOOLEAN NOT NULL DEFAULT FALSE,
    tested_at    TIMESTAMPTZ,
    UNIQUE (code, channel, language, version)
);

CREATE TABLE notification_routing_rules (
    rule_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code   VARCHAR(80) NOT NULL,
    channel      notif_channel NOT NULL,
    max_retries  INT NOT NULL DEFAULT 3,
    retry_backoff_seconds INT NOT NULL DEFAULT 60,
    fallback_channel notif_channel,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notification_preferences (
    user_id      UUID REFERENCES users(user_id) ON DELETE CASCADE,
    channel      notif_channel,
    alert_scenarios scenario_type[],
    alert_radius_km NUMERIC(6,2),
    is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, channel)
);

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_code   VARCHAR(80) NOT NULL,
    channel      notif_channel NOT NULL,
    title        VARCHAR(200),
    body         TEXT NOT NULL,
    related_type VARCHAR(40),                                -- INCIDENT | DONATION | AID | UPDATE
    related_id   UUID,
    status       notif_status NOT NULL DEFAULT 'QUEUED',
    provider_ref VARCHAR(100),
    attempt_count INT NOT NULL DEFAULT 0,
    last_error   TEXT,
    dedupe_key   VARCHAR(150),                               -- AM-NFR-08: prevents duplicate spam
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at      TIMESTAMPTZ,
    read_at      TIMESTAMPTZ,                                -- in-app source of truth
    UNIQUE (user_id, channel, dedupe_key),
    CHECK (status NOT IN ('SENT', 'DELIVERED') OR sent_at IS NOT NULL)
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_retry ON notifications(status) WHERE status IN ('QUEUED', 'RETRYING');

-- ---------------------------------------------------------------------
-- 9. ADMIN: CONFIG, AUDIT, SECURITY, MONITORING, BACKUP, DATA QUALITY (AM-FR-03..10)
-- ---------------------------------------------------------------------
CREATE TABLE system_configs (
    config_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key   VARCHAR(100) NOT NULL,                       -- e.g. SCENARIO_SETTINGS, DUPLICATE_DETECTION
    value        JSONB NOT NULL,
    version      INT NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT FALSE,
    changed_by   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    change_note  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (config_key, version)
);
CREATE UNIQUE INDEX uq_active_config ON system_configs(config_key) WHERE is_active;

CREATE TABLE audit_logs (                                     -- AM-FR-05, DM-NFR-06: Append-only, tamper-evident hash chain
    audit_id     BIGSERIAL PRIMARY KEY,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    actor_role   role_code,
    action       VARCHAR(80) NOT NULL,                         -- e.g. VERIFY_INCIDENT, DISPATCH_SEND, DONATION_CONFIRM
    entity_type  VARCHAR(60) NOT NULL,
    entity_id    UUID,
    result       audit_result NOT NULL,
    rationale    TEXT,
    before_state JSONB,
    after_state  JSONB,
    ip_address   INET,
    prev_hash    CHAR(64),                                     -- cryptographic hash chaining (AM-NFR-09)
    row_hash     CHAR(64)
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, occurred_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, occurred_at DESC);

CREATE TABLE security_events (                                -- AM-FR-07: Security incidents
    event_id     BIGSERIAL PRIMARY KEY,
    event_type   VARCHAR(60) NOT NULL,                         -- UNAUTHORISED_ACCESS, MALWARE_UPLOAD, BRUTE_FORCE, RATE_LIMIT
    severity     priority_level NOT NULL,
    user_id      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    details      JSONB,
    handled_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    handled_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE secret_rotations (
    rotation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_name  VARCHAR(100) NOT NULL,                        -- credential name only, never the value
    rotated_by   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    rotated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_due_at  TIMESTAMPTZ
);

CREATE TABLE integration_health (                             -- AM-FR-04, AM-FR-10: Telemetry & health
    health_id    BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(80) NOT NULL,                         -- PAYMENT_GATEWAY, MAPS, SMS, EMAIL, AI_SERVICE, AGENCY_API
    state        health_state NOT NULL,
    latency_ms   INT,
    error_rate   NUMERIC(5,2),
    queue_depth  INT,
    detail       TEXT,
    checked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_service ON integration_health(service_name, checked_at DESC);

CREATE TABLE alert_rules (
    rule_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(80) NOT NULL,
    condition    JSONB NOT NULL,
    severity     priority_level NOT NULL,
    notify_role  role_code NOT NULL DEFAULT 'APP_MGMT',
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE backups (                                        -- AM-FR-08: Backup & Recovery tracking
    backup_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type  VARCHAR(20) NOT NULL,                         -- FULL, INCREMENTAL
    storage_location TEXT NOT NULL,
    size_bytes   BIGINT,
    checksum     CHAR(64),
    status       backup_status NOT NULL DEFAULT 'RUNNING',
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    verified_at  TIMESTAMPTZ,
    initiated_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE restore_operations (
    restore_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id    UUID NOT NULL REFERENCES backups(backup_id) ON DELETE RESTRICT,
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status       VARCHAR(20) NOT NULL,                         -- REQUESTED, RUNNING, VERIFIED, FAILED
    verification_note TEXT,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);

CREATE TABLE data_correction_tasks (                          -- AM-FR-06: Controlled data modifications
    task_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type    VARCHAR(40) NOT NULL,                         -- CORRECTION, RETENTION_PURGE, BULK_UPDATE
    target_entity VARCHAR(60) NOT NULL,
    affected_count INT,
    justification TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    approved_by  UUID REFERENCES users(user_id) ON DELETE RESTRICT, -- Dual-operator authorization for bulk actions
    status       VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE retention_policies (
    policy_id    SERIAL PRIMARY KEY,
    entity_type  VARCHAR(60) UNIQUE NOT NULL,
    retain_days  INT NOT NULL,
    action_after VARCHAR(20) NOT NULL DEFAULT 'ARCHIVE'         -- ARCHIVE | ANONYMISE | DELETE
);

-- ---------------------------------------------------------------------
-- 10. IDEMPOTENCY (EH-12 / 13.6)
-- ---------------------------------------------------------------------
CREATE TABLE idempotency_keys (
    key          VARCHAR(100) NOT NULL,
    scope        VARCHAR(50) NOT NULL,                          -- INCIDENT_SUBMIT, DONATION_CREATE, DISPATCH_SEND
    user_id      UUID REFERENCES users(user_id) ON DELETE CASCADE,
    request_hash CHAR(64) NOT NULL,
    response_ref UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, key)
);

-- ---------------------------------------------------------------------
-- 11. ANALYTICS & OPERATIONAL VIEWS (DM-FR-14, DM-NFR-12)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_incident_summary AS
SELECT scenario,
       status,
       COALESCE(verified_priority::text, 'UNASSIGNED') AS priority,
       COUNT(*) AS incident_count,
       MAX(updated_at) AS data_fresh_as_of
FROM incidents
GROUP BY scenario, status, verified_priority;

CREATE OR REPLACE VIEW v_donation_summary AS
SELECT c.campaign_id,
       c.title,
       COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'CONFIRMED'), 0) AS confirmed_amount,
       COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'PENDING'), 0)   AS pending_amount,
       COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'FAILED'), 0)    AS failed_amount,
       COUNT(*) FILTER (WHERE d.recon_state IN ('MISMATCH', 'HELD'))   AS reconciliation_exceptions,
       now() AS data_fresh_as_of
FROM donation_campaigns c
LEFT JOIN donations d USING (campaign_id)
GROUP BY c.campaign_id, c.title;

CREATE OR REPLACE VIEW v_aid_summary AS
SELECT aid_type,
       status,
       COUNT(*) AS contributions,
       SUM(quantity) AS total_quantity,
       now() AS data_fresh_as_of
FROM aid_contributions
GROUP BY aid_type, status;

CREATE OR REPLACE VIEW v_dispatch_summary AS
SELECT status,
       priority,
       COUNT(*) AS orders,
       AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))) FILTER (WHERE acknowledged_at IS NOT NULL) AS avg_ack_seconds,
       now() AS data_fresh_as_of
FROM dispatch_orders
GROUP BY status, priority;

CREATE OR REPLACE VIEW v_system_health_summary AS
SELECT service_name,
       state,
       latency_ms,
       error_rate,
       queue_depth,
       checked_at,
       checked_at >= (now() - INTERVAL '5 minutes') AS is_fresh
FROM integration_health
ORDER BY checked_at DESC;

-- ---------------------------------------------------------------------
-- 12. STORED PROCEDURES & TRIGGERS
-- ---------------------------------------------------------------------
-- 12.1 Automatic updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd          BEFORE UPDATE ON users                  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_profiles_upd  BEFORE UPDATE ON user_profiles          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agencies_upd       BEFORE UPDATE ON agencies               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_incidents_upd      BEFORE UPDATE ON incidents              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_resources_upd      BEFORE UPDATE ON resources              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dispatch_upd       BEFORE UPDATE ON dispatch_orders        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_safety_content_upd BEFORE UPDATE ON safety_content         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_public_updates_upd BEFORE UPDATE ON public_updates         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_upd      BEFORE UPDATE ON donation_campaigns     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_donations_upd      BEFORE UPDATE ON donations              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_aid_needs_upd      BEFORE UPDATE ON aid_needs              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_aid_upd            BEFORE UPDATE ON aid_contributions      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_system_configs_upd BEFORE UPDATE ON system_configs         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agency_recip_upd   BEFORE UPDATE ON agency_message_recipients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 12.2 Incident Location Point Geolocation Synchronization
CREATE OR REPLACE FUNCTION fn_sync_incident_location_geom() RETURNS trigger AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND NEW.geom IS NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSIF NEW.geom IS NOT NULL AND (NEW.latitude IS NULL OR NEW.longitude IS NULL) THEN
        NEW.latitude := ST_Y(NEW.geom::geometry);
        NEW.longitude := ST_X(NEW.geom::geometry);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incident_locations_sync_geom
    BEFORE INSERT OR UPDATE ON incident_locations
    FOR EACH ROW EXECUTE FUNCTION fn_sync_incident_location_geom();

-- 12.3 Enforce No False Success: Receipt creation ONLY for confirmed donations (7.3, NU-FR-09)
CREATE OR REPLACE FUNCTION fn_enforce_receipt_on_confirmed_donation() RETURNS trigger AS $$
DECLARE
    v_status txn_status;
BEGIN
    SELECT status INTO v_status FROM donations WHERE donation_id = NEW.donation_id;
    IF v_status IS DISTINCT FROM 'CONFIRMED' THEN
        RAISE EXCEPTION 'Cannot generate receipt for donation %: transaction status is %, must be CONFIRMED.',
            NEW.donation_id, v_status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_receipt_confirmed_only
    BEFORE INSERT OR UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION fn_enforce_receipt_on_confirmed_donation();

-- 12.4 Audit Log Immutability Protection (AM-FR-05, DM-NFR-06)
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 12.5 Audit Log Cryptographic Hash-Chaining (AM-NFR-09)
CREATE OR REPLACE FUNCTION fn_audit_log_hash_chain() RETURNS trigger AS $$
DECLARE
    v_prev_hash CHAR(64);
BEGIN
    SELECT row_hash INTO v_prev_hash FROM audit_logs ORDER BY audit_id DESC LIMIT 1;
    NEW.prev_hash := COALESCE(v_prev_hash, repeat('0', 64));
    NEW.row_hash  := encode(
        digest(
            NEW.prev_hash ||
            NEW.occurred_at::text ||
            COALESCE(NEW.actor_id::text, 'SYSTEM') ||
            NEW.action ||
            NEW.entity_type ||
            COALESCE(NEW.entity_id::text, '') ||
            NEW.result::text ||
            COALESCE(NEW.rationale, ''),
            'sha256'
        ),
        'hex'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_hash_chain
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_hash_chain();

-- ---------------------------------------------------------------------
-- 13. SEED DATA (Roles, Core Permissions, Configuration, Notification Templates)
-- ---------------------------------------------------------------------
INSERT INTO roles (code, description) VALUES
 ('NORMAL_USER',  'Citizen: report incidents, track timeline, donate money, contribute physical aid'),
 ('DISASTER_MGMT','Operational staff: review, verify, triage, dispatch resources, coordinate agencies, publish verified updates'),
 ('APP_MGMT',     'Platform administrator: accounts, RBAC, system config, monitoring, audit, backups, security')
ON CONFLICT (code) DO NOTHING;

-- Populate Granular Permissions mapped to FRs
INSERT INTO permissions (code, description) VALUES
 ('INCIDENT_REPORT',        'Submit emergency incident reports (NU-FR-03)'),
 ('INCIDENT_VIEW_OWN',      'View own submitted incident history and status (NU-FR-06)'),
 ('EVIDENCE_UPLOAD',        'Upload supporting images and evidence files (NU-FR-05)'),
 ('DONATION_CREATE',        'Make monetary relief donations via payment gateway (NU-FR-09)'),
 ('AID_CONTRIBUTE',         'Register physical aid relief supplies (NU-FR-10)'),
 ('INCIDENT_VIEW_ALL',      'View all incoming incidents across scenarios on dashboard (DM-FR-02)'),
 ('INCIDENT_VERIFY',        'Review evidence and make authoritative verification decisions (DM-FR-03)'),
 ('INCIDENT_PRIORITIZE',    'Assign authoritative operational priority and rationale (DM-FR-06)'),
 ('DUPLICATE_REVIEW',       'Review and link or merge duplicate incident candidates (DM-FR-04)'),
 ('AI_TRIAGE_VIEW',         'Inspect AI advisory triage, factors and uncertainty notes (DM-FR-05)'),
 ('AI_DECISION_SUBMIT',     'Record human acceptance, modification, or rejection of AI recommendation (DM-FR-05)'),
 ('RESOURCE_MANAGE',        'Manage and coordinate teams, vehicles, supplies, and equipment (DM-FR-08)'),
 ('DISPATCH_CREATE',        'Authorize and transmit emergency dispatch orders (DM-FR-09)'),
 ('AGENCY_COMMUNICATE',     'Send secure inter-agency coordination messages (DM-FR-10)'),
 ('PUBLIC_UPDATE_PUBLISH',  'Draft and publish verified emergency updates to citizens (DM-FR-11)'),
 ('AID_ALLOCATE',           'Verify and allocate physical aid to approved disaster needs (DM-FR-13)'),
 ('ANALYTICS_VIEW',         'Access operational, donation, and dispatch analytics (DM-FR-14)'),
 ('ACCOUNT_MANAGE',         'Create, update, lock, or assign roles to platform accounts (AM-FR-02)'),
 ('CONFIG_MANAGE',          'Modify and version system configuration settings (AM-FR-03)'),
 ('MONITORING_VIEW',        'Inspect service health, queue depths, and integration telemetry (AM-FR-04)'),
 ('AUDIT_LOG_VIEW',         'Query immutable security and operational audit logs (AM-FR-05)'),
 ('DATA_QUALITY_MANAGE',    'Manage data retention, cleanup, and controlled corrections (AM-FR-06)'),
 ('SECURITY_MANAGE',        'Manage secrets, MFA requirements, and security events (AM-FR-07)'),
 ('BACKUP_MANAGE',          'Trigger, verify, and restore system backups (AM-FR-08)'),
 ('NOTIFICATION_CONFIG',    'Configure notification channels, routing rules, and templates (AM-FR-09)'),
 ('PAYMENT_MONITOR',        'Monitor payment gateway health and reconcile transactions (AM-FR-10)')
ON CONFLICT (code) DO NOTHING;

-- Map Permissions to Roles
-- 1) NORMAL_USER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'NORMAL_USER'
  AND p.code IN (
    'INCIDENT_REPORT', 'INCIDENT_VIEW_OWN', 'EVIDENCE_UPLOAD',
    'DONATION_CREATE', 'AID_CONTRIBUTE'
  )
ON CONFLICT DO NOTHING;

-- 2) DISASTER_MGMT
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'DISASTER_MGMT'
  AND p.code IN (
    'INCIDENT_VIEW_ALL', 'INCIDENT_VERIFY', 'INCIDENT_PRIORITIZE',
    'DUPLICATE_REVIEW', 'AI_TRIAGE_VIEW', 'AI_DECISION_SUBMIT',
    'RESOURCE_MANAGE', 'DISPATCH_CREATE', 'AGENCY_COMMUNICATE',
    'PUBLIC_UPDATE_PUBLISH', 'AID_ALLOCATE', 'ANALYTICS_VIEW'
  )
ON CONFLICT DO NOTHING;

-- 3) APP_MGMT
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'APP_MGMT'
  AND p.code IN (
    'ACCOUNT_MANAGE', 'CONFIG_MANAGE', 'MONITORING_VIEW',
    'AUDIT_LOG_VIEW', 'DATA_QUALITY_MANAGE', 'SECURITY_MANAGE',
    'BACKUP_MANAGE', 'NOTIFICATION_CONFIG', 'PAYMENT_MONITOR', 'ANALYTICS_VIEW'
  )
ON CONFLICT DO NOTHING;

-- Default System Configurations (AM-FR-03)
INSERT INTO system_configs (config_key, value, version, is_active, changed_by, change_note)
SELECT 'SCENARIOS_SUPPORTED',
       '{"scenarios": ["CYCLONE", "INDUSTRIAL_FIRE", "URBAN_FLOODING"], "max_upload_size_mb": 25, "allowed_evidence_types": ["image/jpeg", "image/png", "video/mp4", "application/pdf"]}'::jsonb,
       1, TRUE, u.user_id, 'Initial system baseline from Final SRS'
FROM (SELECT user_id FROM users LIMIT 1) u
WHERE EXISTS (SELECT 1 FROM users)
ON CONFLICT DO NOTHING;

-- Default Notification Templates (NU-FR-07, AM-FR-09)
INSERT INTO notification_templates (code, channel, language, subject, body, version, is_active) VALUES
 ('INCIDENT_SUBMITTED', 'IN_APP', 'en', 'Incident Received', 'Your incident report {incident_ref} has been received and queued for review. Submission is not confirmation of verification or dispatch.', 1, TRUE),
 ('INCIDENT_VERIFIED',  'IN_APP', 'en', 'Incident Verified', 'Your incident report {incident_ref} has been reviewed and verified by disaster response staff.', 1, TRUE),
 ('DONATION_CONFIRMED', 'EMAIL',  'en', 'Donation Receipt - DRCH Relief Fund', 'Thank you for your generous contribution of INR {amount}. Transaction reference: {gateway_txn_ref}. Receipt No: {receipt_no}.', 1, TRUE),
 ('DISPATCH_ALERT',     'PUSH',   'en', 'Emergency Dispatch', 'Dispatch order {dispatch_ref} assigned for scenario {scenario}. Priority: {priority}. Immediate response requested.', 1, TRUE)
ON CONFLICT DO NOTHING;
