-- =====================================================================
-- Disaster Response Coordination Hub (DRCH) - IT314 Software Engineering
-- PostgreSQL 15+ / PostGIS Database Schema (DDL)
--
-- Direct Traceability to Final SRS:
--   * Scenarios strictly limited to: Cyclone, Industrial Fire, Urban Flooding
--   * Core Principles: Human Oversight, State Transparency, No False Success,
--     Auditability (tamper-evident hash chain), Least Privilege (RBAC)
--   * FRs: NU-FR-01..10, DM-FR-01..14, AM-FR-01..10
--   * NFRs: Usability, Accessibility, Performance, Availability, Privacy,
--     Security, Transaction Reliability, Explainability, Data Integrity
--   * Error Handling: EH-01..14 with explicit failure states and idempotency
--   * Architecture: Clean separation of Auth (user_auth) from User profiles (users),
--     all domain attributes consolidated directly into their respective main tables.
-- =====================================================================

BEGIN;

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
-- 1. CORE RBAC & ORGANIZATIONAL INFRASTRUCTURE
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_id      SMALLSERIAL PRIMARY KEY,
    code         role_code UNIQUE NOT NULL,
    description  TEXT
);

CREATE TABLE permissions (
    permission_id SERIAL PRIMARY KEY,
    code          VARCHAR(80) UNIQUE NOT NULL,
    description   TEXT
);

CREATE TABLE role_permissions (
    role_id       SMALLINT REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE agencies (
    agency_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    agency_type   VARCHAR(50) NOT NULL,               -- FIRE, POLICE, NDRF, MEDICAL, MUNICIPAL, NGO
    contact_email CITEXT,
    contact_phone VARCHAR(20),
    api_endpoint  TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. USERS & AUTHENTICATION (NU-FR-01/02, AM-FR-02, EH-02)
--    Separation: users = identity & profile details
--                user_auth = security credentials, MFA & lockouts
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id            SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    email              CITEXT UNIQUE NOT NULL,
    phone              VARCHAR(20),
    full_name          VARCHAR(150) NOT NULL,
    status             account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    preferred_language VARCHAR(10) DEFAULT 'en',
    agency_id          UUID REFERENCES agencies(agency_id) ON DELETE SET NULL,  -- For DISASTER_MGMT personnel
    designation        VARCHAR(100),
    address_line       TEXT,
    city               VARCHAR(100),
    state              VARCHAR(100),
    postal_code        VARCHAR(12),
    consent_given_at   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_users_role   ON users(role_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_agency ON users(agency_id) WHERE agency_id IS NOT NULL;

CREATE TABLE user_auth (
    user_id            UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    password_hash      TEXT NOT NULL,
    mfa_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret         BYTEA,                                 -- Encrypted TOTP secret
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until       TIMESTAMPTZ,
    last_login_at      TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
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

CREATE TABLE login_attempts (                        -- EH-02 rate limiting, brute force prevention
    attempt_id   BIGSERIAL PRIMARY KEY,
    email_tried  CITEXT,
    user_id      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    success      BOOLEAN NOT NULL,
    ip_address   INET,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_email ON login_attempts(email_tried, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip    ON login_attempts(ip_address, attempted_at DESC);

-- ---------------------------------------------------------------------
-- 3. INCIDENTS & EVIDENCE (NU-FR-03..06, DM-FR-02, 7.1, 13.1, 13.2)
--    Consolidated: Location (coordinates, PostGIS geom, address) and
--    scenario-specific details reside directly in the main incidents table.
-- ---------------------------------------------------------------------
CREATE TABLE incidents (
    incident_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_ref       VARCHAR(30) UNIQUE NOT NULL,     -- Human-readable, e.g. INC-2026-000123
    reporter_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    scenario           scenario_type NOT NULL,          -- Cyclone, Industrial Fire, Urban Flooding
    description        TEXT NOT NULL,
    reported_urgency   priority_level,                  -- Citizen-declared, advisory only
    people_affected    INT CHECK (people_affected >= 0),
    status             incident_status NOT NULL DEFAULT 'SUBMITTED',
    verified_priority  priority_level,                  -- Authoritative operational priority (DM-FR-06)
    priority_rationale TEXT,
    canonical_incident_id UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    idempotency_key    VARCHAR(100),                    -- EH-12: idempotent report submission
    
    -- Consolidated Location Details
    location_source    location_source NOT NULL DEFAULT 'GPS',
    latitude           NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude          NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    geom               GEOGRAPHY(Point,4326),
    accuracy_m         NUMERIC(8,2),
    address_text       TEXT,
    landmark           TEXT,

    -- Consolidated Scenario-Specific Attributes (e.g. wind speed, fire type, water depth)
    details            JSONB NOT NULL DEFAULT '{}'::jsonb,

    version            INT NOT NULL DEFAULT 1,          -- Optimistic locking for triage (DM-NFR-11)
    submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at          TIMESTAMPTZ,
    
    UNIQUE (reporter_id, idempotency_key),
    CHECK (geom IS NOT NULL OR address_text IS NOT NULL),
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
    CHECK (status NOT IN ('VERIFIED', 'DISPATCHED', 'RESOLVED') OR verified_priority IS NOT NULL),
    CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
);
CREATE INDEX idx_incidents_status_prio ON incidents(status, verified_priority);
CREATE INDEX idx_incidents_scenario    ON incidents(scenario, submitted_at DESC);
CREATE INDEX idx_incidents_reporter    ON incidents(reporter_id, submitted_at DESC);
CREATE INDEX idx_incidents_geom        ON incidents USING GIST (geom);

CREATE TABLE incident_status_history (               -- NU-FR-06: State transparency & citizen timeline
    history_id   BIGSERIAL PRIMARY KEY,
    incident_id  UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    from_status  incident_status,
    to_status    incident_status NOT NULL,
    changed_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reason       TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inc_hist ON incident_status_history(incident_id, changed_at);

CREATE TABLE evidence_files (                        -- NU-FR-05, EH-03: Media uploads & antivirus scan
    evidence_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    file_name       VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    size_bytes      BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_key     TEXT NOT NULL,
    sha256          CHAR(64) NOT NULL,
    scan_state      scan_status NOT NULL DEFAULT 'PENDING',
    scan_detail     TEXT,
    moderation_flag BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_incident ON evidence_files(incident_id);
CREATE INDEX idx_evidence_scan     ON evidence_files(scan_state);

CREATE TABLE incident_duplicate_links (              -- DM-FR-04, EH-04: Non-destructive duplicate grouping
    link_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_a   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    incident_b   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    similarity   NUMERIC(4,3),
    match_basis  JSONB,
    detected_by  VARCHAR(20) NOT NULL,                -- RULES | AI
    relation     duplicate_relation NOT NULL DEFAULT 'CANDIDATE',
    reviewed_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (incident_a < incident_b),                 -- Prevents duplicate inverse pairs
    UNIQUE (incident_a, incident_b)
);

-- ---------------------------------------------------------------------
-- 4. VERIFICATION & AI TRIAGE (DM-FR-03..06, 7.2, 13.2)
--    AI recommendations and human oversight decisions consolidated
-- ---------------------------------------------------------------------
CREATE TABLE verification_decisions (                -- Authoritative human verification decisions (DM-FR-03)
    decision_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id    UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE RESTRICT,
    decided_by     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    decision       verification_decision NOT NULL,
    rationale      TEXT NOT NULL,
    info_requested TEXT,
    decided_at     TIMESTAMPTZ NOT NULL DEFAULT now()
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

CREATE TABLE ai_recommendations (                    -- Advisory only (DM-FR-05) + Human review (DM-NFR-10)
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id       UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    model_id          INT REFERENCES ai_models(model_id),
    requested_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    status            ai_rec_status NOT NULL,
    suggested_scenario scenario_type,
    suggested_priority priority_level,
    confidence        NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    uncertainty_note  TEXT,
    factors           JSONB,                          -- Explainable AI factors (DM-NFR-09)
    guardrail_result  JSONB,
    
    -- Consolidated Human Review Result
    human_action      ai_decision_action,             -- ACCEPTED, MODIFIED, REJECTED
    human_decided_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    human_rationale   TEXT,
    decided_at        TIMESTAMPTZ,
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_rec_incident ON ai_recommendations(incident_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. RESOURCES & EMERGENCY DISPATCH (DM-FR-07..10, 7.5, 13.5)
-- ---------------------------------------------------------------------
CREATE TABLE resources (
    resource_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id          UUID REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    type               resource_type NOT NULL,
    name               VARCHAR(150) NOT NULL,
    capability         JSONB,                         -- e.g. {"boat": true, "capacity": 12}
    status             resource_status NOT NULL DEFAULT 'AVAILABLE',
    home_geom          GEOGRAPHY(Point,4326),
    current_geom       GEOGRAPHY(Point,4326),
    location_updated_at TIMESTAMPTZ,
    quantity_total     NUMERIC(12,2),
    quantity_available NUMERIC(12,2),
    version            INT NOT NULL DEFAULT 1,        -- Optimistic locking (DM-NFR-11)
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_available IS NULL OR quantity_available >= 0),
    CHECK (quantity_total IS NULL OR quantity_available <= quantity_total)
);
CREATE INDEX idx_resources_status ON resources(type, status);
CREATE INDEX idx_resources_geom   ON resources USING GIST (current_geom);

CREATE TABLE dispatch_orders (
    dispatch_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_ref        VARCHAR(30) UNIQUE NOT NULL,  -- e.g. DISP-2026-000456
    incident_id         UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE RESTRICT,
    created_by          UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    receiving_agency_id UUID REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    status              dispatch_status NOT NULL DEFAULT 'REQUESTED',
    instructions        TEXT,
    priority            priority_level NOT NULL,
    acknowledged_by     TEXT,
    acknowledged_at     TIMESTAMPTZ,
    failure_reason      TEXT,
    idempotency_key     VARCHAR(100) UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status NOT IN ('ACKNOWLEDGED', 'DISPATCHED', 'COMPLETED') OR (acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL)),
    CHECK (status NOT IN ('FAILED', 'REJECTED') OR failure_reason IS NOT NULL)
);
CREATE INDEX idx_dispatch_incident ON dispatch_orders(incident_id);
CREATE INDEX idx_dispatch_status   ON dispatch_orders(status);

CREATE TABLE resource_assignments (
    assignment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id    UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    resource_id    UUID NOT NULL REFERENCES resources(resource_id) ON DELETE RESTRICT,
    quantity       NUMERIC(12,2) DEFAULT 1,
    assigned_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at    TIMESTAMPTZ,
    release_reason TEXT
);
CREATE INDEX idx_assignments_active ON resource_assignments(resource_id) WHERE released_at IS NULL;

CREATE TABLE dispatch_events (                        -- State transitions log
    event_id    BIGSERIAL PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    from_status dispatch_status,
    to_status   dispatch_status NOT NULL,
    source      VARCHAR(50) NOT NULL,                 -- OPERATOR | AGENCY_API | SYSTEM
    actor_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    payload     JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_events ON dispatch_events(dispatch_id, occurred_at);

CREATE TABLE agency_messages (                        -- DM-FR-10: Inter-agency communication
    message_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    recipient_agency_id UUID NOT NULL REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    incident_id         UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    dispatch_id         UUID REFERENCES dispatch_orders(dispatch_id) ON DELETE SET NULL,
    subject             VARCHAR(200),
    body                TEXT NOT NULL,
    status              msg_status NOT NULL DEFAULT 'QUEUED',
    acknowledged_at     TIMESTAMPTZ,
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agency_msgs_agency ON agency_messages(recipient_agency_id, status);

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
-- 6. PUBLIC CONTENT & VERIFIED UPDATES (NU-FR-08, DM-FR-11)
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
    update_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id       UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    scenario          scenario_type,
    title             VARCHAR(200) NOT NULL,
    body              TEXT NOT NULL,
    affected_area     GEOGRAPHY(Geometry, 4326),
    area_label        VARCHAR(200),
    version           INT NOT NULL DEFAULT 1,
    supersedes_id     UUID REFERENCES public_updates(update_id) ON DELETE SET NULL,
    status            content_status NOT NULL DEFAULT 'DRAFT',
    published_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    published_at      TIMESTAMPTZ,
    send_notification BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_public_updates_pub ON public_updates(status, published_at DESC);

-- ---------------------------------------------------------------------
-- 7. MONETARY DONATIONS (NU-FR-09, DM-FR-12, AM-FR-10, 7.3, 13.3)
--    Receipt details consolidated directly into donations table
-- ---------------------------------------------------------------------
CREATE TABLE donation_campaigns (
    campaign_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(200) NOT NULL,
    purpose       TEXT NOT NULL,
    scenario      scenario_type,
    target_amount NUMERIC(14,2),
    currency      CHAR(3) NOT NULL DEFAULT 'INR',
    status        campaign_status NOT NULL DEFAULT 'DRAFT',
    approved_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    starts_at     TIMESTAMPTZ,
    ends_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE donations (
    donation_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES donation_campaigns(campaign_id) ON DELETE RESTRICT,
    donor_id            UUID REFERENCES users(user_id) ON DELETE SET NULL,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    status              txn_status NOT NULL DEFAULT 'PENDING',
    is_anonymous        BOOLEAN NOT NULL DEFAULT FALSE,
    donor_name          VARCHAR(150),
    donor_email         CITEXT,
    gateway_name        VARCHAR(50),
    gateway_order_id    VARCHAR(100),
    gateway_txn_ref     VARCHAR(100),
    payment_method_type VARCHAR(30),
    failure_code        VARCHAR(50),
    failure_message     TEXT,
    recon_state         recon_status NOT NULL DEFAULT 'UNRECONCILED',
    idempotency_key     VARCHAR(100) NOT NULL UNIQUE,

    -- Consolidated Receipt Details (generated upon confirmation)
    receipt_no          VARCHAR(40) UNIQUE,
    receipt_issued_at   TIMESTAMPTZ,
    receipt_document_url TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at        TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (gateway_name, gateway_txn_ref),
    CHECK (status <> 'CONFIRMED' OR (gateway_txn_ref IS NOT NULL AND confirmed_at IS NOT NULL)),
    CHECK (receipt_no IS NULL OR status = 'CONFIRMED')
);
CREATE INDEX idx_donations_status   ON donations(status, created_at DESC);
CREATE INDEX idx_donations_campaign ON donations(campaign_id, status);
CREATE INDEX idx_donations_donor    ON donations(donor_id);

CREATE TABLE payment_callbacks (                          -- Raw signed webhook callbacks
    callback_id     BIGSERIAL PRIMARY KEY,
    donation_id     UUID REFERENCES donations(donation_id) ON DELETE CASCADE,
    gateway_name    VARCHAR(50) NOT NULL,
    event_type      VARCHAR(60),
    signature_valid BOOLEAN NOT NULL,
    payload         JSONB NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    process_result  VARCHAR(30)
);
CREATE INDEX idx_callbacks_donation ON payment_callbacks(donation_id);

CREATE TABLE reconciliation_records (                     -- AM-FR-10: Gateway reconciliation
    recon_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id     UUID REFERENCES donations(donation_id) ON DELETE RESTRICT,
    gateway_amount  NUMERIC(14,2),
    app_amount      NUMERIC(14,2),
    result          recon_status NOT NULL,
    mismatch_detail TEXT,
    run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ
);

CREATE TABLE fund_utilisations (                          -- DM-FR-12: Full audit trail of fund relief spending
    utilisation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id    UUID NOT NULL REFERENCES donation_campaigns(campaign_id) ON DELETE RESTRICT,
    incident_id    UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    purpose        TEXT NOT NULL,
    approved_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. PHYSICAL AID (NU-FR-10, DM-FR-12/13, 7.4, 13.4)
-- ---------------------------------------------------------------------
CREATE TABLE aid_needs (                                  -- Verified disaster demand for aid supplies
    need_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id        UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    campaign_id        UUID REFERENCES donation_campaigns(campaign_id) ON DELETE SET NULL,
    aid_type           VARCHAR(80) NOT NULL,
    quantity_required  NUMERIC(12,2) NOT NULL CHECK (quantity_required > 0),
    quantity_fulfilled NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit               VARCHAR(30) NOT NULL,
    delivery_geom      GEOGRAPHY(Point,4326),
    delivery_address   TEXT,
    needed_by          TIMESTAMPTZ,
    approved_by        UUID REFERENCES users(user_id) ON DELETE SET NULL,
    is_open            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_fulfilled <= quantity_required)
);

CREATE TABLE aid_contributions (                          -- Citizen supply contributions
    contribution_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    aid_type         VARCHAR(80) NOT NULL,
    description      TEXT,
    quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit             VARCHAR(30) NOT NULL,
    condition_desc   VARCHAR(100),
    expiry_date      DATE,
    pickup_address   TEXT,
    pickup_geom      GEOGRAPHY(Point,4326),
    contact_phone    VARCHAR(20),
    available_from   TIMESTAMPTZ,
    available_until  TIMESTAMPTZ,
    status           aid_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aid_status      ON aid_contributions(status);
CREATE INDEX idx_aid_contributor ON aid_contributions(contributor_id);

CREATE TABLE aid_allocations (                            -- Match verified supply to approved need
    allocation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_id UUID NOT NULL REFERENCES aid_contributions(contribution_id) ON DELETE RESTRICT,
    need_id         UUID NOT NULL REFERENCES aid_needs(need_id) ON DELETE RESTRICT,
    quantity        NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    allocated_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status          aid_status NOT NULL DEFAULT 'ALLOCATED',
    allocated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delivery_tasks (                             -- Logistics delivery tracking
    delivery_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id        UUID NOT NULL REFERENCES aid_allocations(allocation_id) ON DELETE RESTRICT,
    assigned_resource_id UUID REFERENCES resources(resource_id) ON DELETE SET NULL,
    status               delivery_status NOT NULL DEFAULT 'CREATED',
    scheduled_pickup     TIMESTAMPTZ,
    picked_up_at         TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ,
    received_by          VARCHAR(150),
    confirmed_by         UUID REFERENCES users(user_id) ON DELETE SET NULL,
    failure_reason       TEXT,
    attempt_no           INT NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
    CHECK (status <> 'DELIVERED' OR (delivered_at IS NOT NULL AND confirmed_by IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- 9. NOTIFICATIONS (NU-FR-07, AM-FR-09, EH-13, AM-NFR-08)
-- ---------------------------------------------------------------------
CREATE TABLE notification_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(80) NOT NULL,
    channel     notif_channel NOT NULL,
    language    VARCHAR(10) NOT NULL DEFAULT 'en',
    subject     VARCHAR(200),
    body        TEXT NOT NULL,
    version     INT NOT NULL DEFAULT 1,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    tested_at   TIMESTAMPTZ,
    UNIQUE (code, channel, language, version)
);

CREATE TABLE notification_routing_rules (
    rule_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code            VARCHAR(80) NOT NULL,
    channel               notif_channel NOT NULL,
    max_retries           INT NOT NULL DEFAULT 3,
    retry_backoff_seconds INT NOT NULL DEFAULT 60,
    fallback_channel      notif_channel,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notification_preferences (
    user_id         UUID REFERENCES users(user_id) ON DELETE CASCADE,
    channel         notif_channel,
    alert_scenarios scenario_type[],
    alert_radius_km NUMERIC(6,2),
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, channel)
);

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_code      VARCHAR(80) NOT NULL,
    channel         notif_channel NOT NULL,
    title           VARCHAR(200),
    body            TEXT NOT NULL,
    related_type    VARCHAR(40),
    related_id      UUID,
    status          notif_status NOT NULL DEFAULT 'QUEUED',
    provider_ref    VARCHAR(100),
    attempt_count   INT NOT NULL DEFAULT 0,
    last_error      TEXT,
    dedupe_key      VARCHAR(150),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    UNIQUE (user_id, channel, dedupe_key),
    CHECK (status NOT IN ('SENT', 'DELIVERED') OR sent_at IS NOT NULL)
);
CREATE INDEX idx_notif_user  ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_retry ON notifications(status) WHERE status IN ('QUEUED', 'RETRYING');

-- ---------------------------------------------------------------------
-- 10. SYSTEM CONFIG, AUDIT, SECURITY, MONITORING & BACKUP (AM-FR-03..08)
-- ---------------------------------------------------------------------
CREATE TABLE system_configs (
    config_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key  VARCHAR(100) NOT NULL,
    value       JSONB NOT NULL,
    version     INT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    changed_by  UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    change_note TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (config_key, version)
);
CREATE UNIQUE INDEX uq_active_config ON system_configs(config_key) WHERE is_active;

CREATE TABLE audit_logs (                             -- AM-FR-05: Append-only, tamper-evident hash chain
    audit_id     BIGSERIAL PRIMARY KEY,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    actor_role   role_code,
    action       VARCHAR(80) NOT NULL,
    entity_type  VARCHAR(60) NOT NULL,
    entity_id    UUID,
    result       audit_result NOT NULL,
    rationale    TEXT,
    before_state JSONB,
    after_state  JSONB,
    ip_address   INET,
    prev_hash    CHAR(64),
    row_hash     CHAR(64)
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, occurred_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, occurred_at DESC);

CREATE TABLE security_events (                        -- AM-FR-07: Security incidents
    event_id   BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(60) NOT NULL,                  -- UNAUTHORISED_ACCESS, MALWARE_UPLOAD, BRUTE_FORCE, RATE_LIMIT
    severity   priority_level NOT NULL,
    user_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    details    JSONB,
    handled_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_health (                     -- AM-FR-04, AM-FR-10: Telemetry & health
    health_id    BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(80) NOT NULL,                -- PAYMENT_GATEWAY, MAPS, SMS, EMAIL, AI_SERVICE, AGENCY_API
    state        health_state NOT NULL,
    latency_ms   INT,
    error_rate   NUMERIC(5,2),
    queue_depth  INT,
    detail       TEXT,
    checked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_service ON integration_health(service_name, checked_at DESC);

CREATE TABLE backups (                                -- AM-FR-08: Backup & Recovery tracking
    backup_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type      VARCHAR(20) NOT NULL,
    storage_location TEXT NOT NULL,
    size_bytes       BIGINT,
    checksum         CHAR(64),
    status           backup_status NOT NULL DEFAULT 'RUNNING',
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ,
    verified_at      TIMESTAMPTZ,
    initiated_by     UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE idempotency_keys (                       -- EH-12: API Idempotency cache
    key          VARCHAR(100) NOT NULL,
    scope        VARCHAR(50) NOT NULL,
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

CREATE OR REPLACE VIEW v_incident_dashboard AS
SELECT i.incident_id,
       i.incident_ref,
       i.scenario,
       i.status,
       i.verified_priority,
       i.reported_urgency,
       i.people_affected,
       i.latitude,
       i.longitude,
       i.address_text,
       i.landmark,
       i.submitted_at,
       i.updated_at,
       u.full_name AS reporter_name,
       u.phone     AS reporter_phone
FROM incidents i
JOIN users u ON i.reporter_id = u.user_id;

CREATE OR REPLACE VIEW v_resource_availability AS
SELECT r.resource_id,
       r.name,
       r.type,
       r.status,
       r.quantity_total,
       r.quantity_available,
       a.name AS agency_name,
       r.location_updated_at
FROM resources r
LEFT JOIN agencies a ON r.agency_id = a.agency_id;

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
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Timestamp auto-update triggers
CREATE TRIGGER trg_users_upd          BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_auth_upd      BEFORE UPDATE ON user_auth          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agencies_upd       BEFORE UPDATE ON agencies           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_incidents_upd      BEFORE UPDATE ON incidents          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_resources_upd      BEFORE UPDATE ON resources          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dispatch_upd       BEFORE UPDATE ON dispatch_orders    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agency_msgs_upd    BEFORE UPDATE ON agency_messages    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_safety_content_upd BEFORE UPDATE ON safety_content     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_public_updates_upd BEFORE UPDATE ON public_updates     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_upd      BEFORE UPDATE ON donation_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_donations_upd      BEFORE UPDATE ON donations          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_aid_needs_upd      BEFORE UPDATE ON aid_needs          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_aid_upd            BEFORE UPDATE ON aid_contributions  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_system_configs_upd BEFORE UPDATE ON system_configs     FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spatial point & coordinates bi-directional sync directly in incidents
CREATE OR REPLACE FUNCTION fn_sync_incident_geom() RETURNS trigger AS $$
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

CREATE TRIGGER trg_incidents_sync_geom
    BEFORE INSERT OR UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION fn_sync_incident_geom();

-- Receipt rule: Receipt number only allowed when donation status is CONFIRMED
CREATE OR REPLACE FUNCTION fn_enforce_receipt_on_confirmed_donation() RETURNS trigger AS $$
BEGIN
    IF NEW.receipt_no IS NOT NULL AND NEW.status <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'Cannot generate receipt for donation %: transaction status is %, must be CONFIRMED.',
            NEW.donation_id, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_receipt_confirmed_only
    BEFORE INSERT OR UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION fn_enforce_receipt_on_confirmed_donation();

-- Immutable Audit Log Trigger
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- SHA-256 Tamper-Evident Hash Chaining Trigger
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

COMMIT;
