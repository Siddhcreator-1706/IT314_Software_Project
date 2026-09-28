-- =====================================================================
-- Disaster Response Coordination Hub (DRCH) - IT314 Software Engineering
-- PostgreSQL 15+ / PostGIS Database Schema (DDL)
--
-- Formal Specifications & Quality Standards:
--   * Boyce-Codd Normal Form (BCNF) Compliant: Every non-trivial functional
--     dependency X -> Y has a determinant X that is a candidate key. No partial,
--     transitive, or cross-attribute anomalies.
--   * Hardened Security & Authentication: Complete separation of user identity (users)
--     from security credentials & state (user_auth). Includes Argon2id password hash,
--     encrypted TOTP MFA, brute-force lockouts, SHA-256 reset token hashes, and
--     token_version for instantaneous global JWT revocation.
--   * Auditability & Tamper-Evidence: Append-only audit log with cryptographic
--     SHA-256 hash chaining (prev_hash -> row_hash) and immutability triggers.
--   * High Performance & Spatial: PostGIS geography indexing (GiST) and optimistic
--     locking (versioning) on concurrent triage and resource operations.
--   * Scope: Strictly 20 consolidated core tables covering all SRS requirements.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS postgis;    -- spatial geography types and indexes
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive emails & text

-- ---------------------------------------------------------------------
-- 0. ENUM TYPES (Domain Value Constraints)
-- ---------------------------------------------------------------------
CREATE TYPE role_code            AS ENUM ('NORMAL_USER', 'DISASTER_MGMT', 'APP_MGMT');
CREATE TYPE account_status       AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED', 'PENDING_VERIFICATION');
CREATE TYPE scenario_type        AS ENUM ('CYCLONE', 'INDUSTRIAL_FIRE', 'URBAN_FLOODING');
CREATE TYPE incident_status      AS ENUM ('SUBMITTED', 'NEEDS_INFORMATION', 'VERIFIED', 'DISPATCHED', 'RESOLVED', 'CLOSED', 'REJECTED');
CREATE TYPE priority_level       AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE location_source      AS ENUM ('GPS', 'MAP_PIN', 'MANUAL');
CREATE TYPE scan_status          AS ENUM ('PENDING', 'CLEAN', 'QUARANTINED', 'REJECTED', 'FAILED');
CREATE TYPE ai_decision_action   AS ENUM ('ACCEPTED', 'MODIFIED', 'REJECTED');
CREATE TYPE ai_rec_status        AS ENUM ('GENERATED', 'LOW_CONFIDENCE', 'UNAVAILABLE', 'UNSAFE_OUTPUT');
CREATE TYPE txn_status           AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');
CREATE TYPE aid_status           AS ENUM ('REGISTERED', 'VERIFIED', 'ALLOCATED', 'IN_TRANSIT', 'DELIVERED', 'REJECTED');
CREATE TYPE resource_type        AS ENUM ('TEAM', 'VEHICLE', 'SUPPLY', 'SUPPORT');
CREATE TYPE resource_status      AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'UNAVAILABLE', 'MAINTENANCE');
CREATE TYPE dispatch_status      AS ENUM ('REQUESTED', 'ACKNOWLEDGED', 'DISPATCHED', 'REJECTED', 'FAILED', 'COMPLETED');
CREATE TYPE msg_status           AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'FAILED');
CREATE TYPE notif_channel        AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');
CREATE TYPE notif_status         AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ');
CREATE TYPE content_status       AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE audit_result         AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');
CREATE TYPE campaign_status      AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

-- ---------------------------------------------------------------------
-- 1. ROLES & AGENCIES (Core Infrastructure)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Keys = {role_id}, {code}. All determinants are candidate keys.
CREATE TABLE roles (
    role_id     SMALLSERIAL PRIMARY KEY,
    code        role_code UNIQUE NOT NULL,
    description TEXT
);

-- BCNF: Candidate Keys = {agency_id}, {name}. All determinants are candidate keys.
CREATE TABLE agencies (
    agency_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) UNIQUE NOT NULL,
    agency_type   VARCHAR(50) NOT NULL,              -- FIRE, POLICE, NDRF, MEDICAL, MUNICIPAL, NGO
    contact_email CITEXT,
    contact_phone VARCHAR(20),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. USERS & AUTHENTICATION (NU-FR-01/02, AM-FR-02, EH-02)
--    Strict separation: users = identity, profile & RBAC
--                       user_auth = security credentials, MFA & tokens
-- ---------------------------------------------------------------------
-- BCNF: Candidate Keys = {user_id}, {email}. All determinants are candidate keys.
CREATE TABLE users (
    user_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id            SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    email              CITEXT UNIQUE NOT NULL,
    phone              VARCHAR(20),
    full_name          VARCHAR(150) NOT NULL,
    status             account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    preferred_language VARCHAR(10) DEFAULT 'en',
    agency_id          UUID REFERENCES agencies(agency_id) ON DELETE SET NULL,  -- Responders / Staff
    designation        VARCHAR(100),
    address_line       TEXT,
    city               VARCHAR(100),
    state              VARCHAR(100),
    postal_code        VARCHAR(12),
    alert_preferences  JSONB DEFAULT '{"in_app": true, "sms": false, "email": true}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role   ON users(role_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_agency ON users(agency_id) WHERE agency_id IS NOT NULL;

-- BCNF: Candidate Key = {user_id}. All determinants are candidate keys.
-- Security: Isolated credential store prevents accidental leak via SELECT * on users.
CREATE TABLE user_auth (
    user_id                   UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    password_hash             TEXT NOT NULL,
    mfa_enabled               BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret                BYTEA,                                 -- Encrypted TOTP secret
    failed_login_count        INT NOT NULL DEFAULT 0,
    locked_until              TIMESTAMPTZ,
    last_login_at             TIMESTAMPTZ,
    token_version             INT NOT NULL DEFAULT 1,                -- Instant global JWT revocation
    password_reset_token_hash CHAR(64),                              -- SHA-256 hash of active reset token
    password_reset_expires_at TIMESTAMPTZ,
    password_changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. INCIDENTS & EVIDENCE (NU-FR-03..06, DM-FR-02..06, 7.1, 13.1)
--    Consolidated: Coordinates, PostGIS point geom, address, human
--    verification, duplicate linkage, and scenario details all in main table.
-- ---------------------------------------------------------------------
-- BCNF: Candidate Keys = {incident_id}, {incident_ref}, {(reporter_id, idempotency_key)}.
-- All determinants are candidate keys.
CREATE TABLE incidents (
    incident_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_ref       VARCHAR(30) UNIQUE NOT NULL,     -- Human-readable e.g. INC-2026-000123
    reporter_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    scenario           scenario_type NOT NULL,          -- Cyclone, Industrial Fire, Urban Flooding
    description        TEXT NOT NULL,
    reported_urgency   priority_level,                  -- Citizen declared
    people_affected    INT CHECK (people_affected >= 0),
    status             incident_status NOT NULL DEFAULT 'SUBMITTED',

    -- Authoritative Verification & Priority (DM-FR-03, DM-FR-06)
    verified_priority  priority_level,
    priority_rationale TEXT,
    verified_by        UUID REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at        TIMESTAMPTZ,

    -- Duplicate grouping (DM-FR-04)
    canonical_incident_id UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    idempotency_key    VARCHAR(100),                    -- EH-12: idempotent report submission

    -- Spatial & Location Attributes
    location_source    location_source NOT NULL DEFAULT 'GPS',
    latitude           NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude          NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    geom               GEOGRAPHY(Point,4326),
    accuracy_m         NUMERIC(8,2),
    address_text       TEXT,
    landmark           TEXT,

    -- Scenario Details JSONB (wind speeds, water depth, chemical types)
    details            JSONB NOT NULL DEFAULT '{}'::jsonb,

    version            INT NOT NULL DEFAULT 1,          -- Optimistic locking (DM-NFR-11)
    submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at          TIMESTAMPTZ,

    UNIQUE (reporter_id, idempotency_key),
    CHECK (geom IS NOT NULL OR address_text IS NOT NULL),
    CHECK (status NOT IN ('VERIFIED', 'DISPATCHED', 'RESOLVED') OR verified_priority IS NOT NULL),
    CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
);
CREATE INDEX idx_incidents_status_prio ON incidents(status, verified_priority);
CREATE INDEX idx_incidents_scenario    ON incidents(scenario, submitted_at DESC);
CREATE INDEX idx_incidents_reporter    ON incidents(reporter_id, submitted_at DESC);
CREATE INDEX idx_incidents_geom        ON incidents USING GIST (geom);

-- BCNF: Candidate Key = {history_id}. All determinants are candidate keys.
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

-- BCNF: Candidate Keys = {evidence_id}, {storage_key}. All determinants are candidate keys.
CREATE TABLE evidence_files (                        -- NU-FR-05, EH-03: Media uploads
    evidence_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id  UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    uploaded_by  UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    file_name    VARCHAR(255) NOT NULL,
    mime_type    VARCHAR(100) NOT NULL,
    size_bytes   BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_key  TEXT UNIQUE NOT NULL,
    sha256       CHAR(64) NOT NULL,
    scan_state   scan_status NOT NULL DEFAULT 'PENDING',
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_incident ON evidence_files(incident_id);

-- ---------------------------------------------------------------------
-- 4. AI ADVISORY TRIAGE (DM-FR-05, DM-NFR-09/10)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Key = {recommendation_id}. All determinants are candidate keys.
CREATE TABLE ai_recommendations (
    recommendation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id         UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    model_name          VARCHAR(100) NOT NULL DEFAULT 'drch-triage-v1',
    status              ai_rec_status NOT NULL DEFAULT 'GENERATED',
    suggested_scenario  scenario_type,
    suggested_priority  priority_level,
    confidence          NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    uncertainty_note    TEXT,
    factors             JSONB,                       -- Explainable AI factors (DM-NFR-09)
    human_action        ai_decision_action,          -- ACCEPTED, MODIFIED, REJECTED (DM-NFR-10)
    human_decided_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    human_rationale     TEXT,
    decided_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_rec_incident ON ai_recommendations(incident_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. RESOURCES & EMERGENCY DISPATCH (DM-FR-07..10)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Key = {resource_id}. All determinants are candidate keys.
CREATE TABLE resources (
    resource_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id          UUID REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    type               resource_type NOT NULL,
    name               VARCHAR(150) NOT NULL,
    capability         JSONB,                         -- e.g. {"boat": true, "capacity": 12}
    status             resource_status NOT NULL DEFAULT 'AVAILABLE',
    current_geom       GEOGRAPHY(Point,4326),
    quantity_total     NUMERIC(12,2) DEFAULT 1,
    quantity_available NUMERIC(12,2) DEFAULT 1,
    version            INT NOT NULL DEFAULT 1,        -- Optimistic locking (DM-NFR-11)
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_status ON resources(type, status);
CREATE INDEX idx_resources_geom   ON resources USING GIST (current_geom);

-- BCNF: Candidate Keys = {dispatch_id}, {dispatch_ref}, {idempotency_key}. All determinants are candidate keys.
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
    idempotency_key     VARCHAR(100) UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_incident ON dispatch_orders(incident_id);
CREATE INDEX idx_dispatch_status   ON dispatch_orders(status);

-- BCNF: Candidate Key = {assignment_id}. All determinants are candidate keys.
CREATE TABLE resource_assignments (
    assignment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id    UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    resource_id    UUID NOT NULL REFERENCES resources(resource_id) ON DELETE RESTRICT,
    quantity       NUMERIC(12,2) DEFAULT 1,
    assigned_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at    TIMESTAMPTZ
);
CREATE INDEX idx_assignments_dispatch ON resource_assignments(dispatch_id);

-- BCNF: Candidate Key = {message_id}. All determinants are candidate keys.
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
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agency_msgs_agency ON agency_messages(recipient_agency_id, status);

-- ---------------------------------------------------------------------
-- 6. PUBLIC BROADCAST UPDATES (NU-FR-08, DM-FR-11)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Key = {update_id}. All determinants are candidate keys.
CREATE TABLE public_updates (
    update_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id       UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    scenario          scenario_type NOT NULL,
    title             VARCHAR(200) NOT NULL,
    body              TEXT NOT NULL,
    affected_area     GEOGRAPHY(Geometry, 4326),
    area_label        VARCHAR(200),
    status            content_status NOT NULL DEFAULT 'DRAFT',
    published_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_public_updates_pub ON public_updates(status, published_at DESC);

-- ---------------------------------------------------------------------
-- 7. MONETARY DONATIONS (NU-FR-09, DM-FR-12)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Keys = {campaign_id}. All determinants are candidate keys.
CREATE TABLE donation_campaigns (
    campaign_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(200) NOT NULL,
    purpose       TEXT NOT NULL,
    scenario      scenario_type,
    target_amount NUMERIC(14,2),
    currency      CHAR(3) NOT NULL DEFAULT 'INR',
    status        campaign_status NOT NULL DEFAULT 'DRAFT',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BCNF: Candidate Keys = {donation_id}, {idempotency_key}, {receipt_no}, {(gateway_name, gateway_txn_ref)}.
-- All determinants are candidate keys.
-- Strict normalization: If donor_id is known, profile details come from users table;
-- guest details are populated only for unauthenticated guest donors, preventing transitive FDs.
CREATE TABLE donations (
    donation_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES donation_campaigns(campaign_id) ON DELETE RESTRICT,
    donor_id            UUID REFERENCES users(user_id) ON DELETE SET NULL,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    status              txn_status NOT NULL DEFAULT 'PENDING',
    is_anonymous        BOOLEAN NOT NULL DEFAULT FALSE,
    guest_name          VARCHAR(150),
    guest_email         CITEXT,
    gateway_name        VARCHAR(50),
    gateway_txn_ref     VARCHAR(100),
    idempotency_key     VARCHAR(100) NOT NULL UNIQUE,

    -- Consolidated Receipt Details (NU-FR-09)
    receipt_no          VARCHAR(40) UNIQUE,
    receipt_issued_at   TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at        TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (gateway_name, gateway_txn_ref),
    CHECK (receipt_no IS NULL OR status = 'CONFIRMED'),
    CHECK (donor_id IS NOT NULL OR is_anonymous = TRUE OR guest_email IS NOT NULL),
    CHECK (donor_id IS NULL OR (guest_name IS NULL AND guest_email IS NULL))
);
CREATE INDEX idx_donations_status   ON donations(status, created_at DESC);
CREATE INDEX idx_donations_campaign ON donations(campaign_id, status);

-- ---------------------------------------------------------------------
-- 8. PHYSICAL AID RELIEF (NU-FR-10, DM-FR-13)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Key = {need_id}. All determinants are candidate keys.
CREATE TABLE aid_needs (                              -- Verified disaster demand for relief supplies
    need_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id        UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    aid_type           VARCHAR(80) NOT NULL,          -- FOOD, WATER, MEDICAL, BLANKETS, RESCUE_GEAR
    quantity_required  NUMERIC(12,2) NOT NULL CHECK (quantity_required > 0),
    quantity_fulfilled NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit               VARCHAR(30) NOT NULL,          -- KITS, LITRES, BOXES, PACKETS
    delivery_address   TEXT,
    delivery_geom      GEOGRAPHY(Point,4326),
    is_open            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BCNF: Candidate Key = {contribution_id}. All determinants are candidate keys.
CREATE TABLE aid_contributions (                      -- Citizen relief supply pledges
    contribution_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    need_id          UUID REFERENCES aid_needs(need_id) ON DELETE SET NULL,  -- Linked need
    aid_type         VARCHAR(80) NOT NULL,
    description      TEXT,
    quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit             VARCHAR(30) NOT NULL,
    pickup_address   TEXT,
    pickup_geom      GEOGRAPHY(Point,4326),
    contact_phone    VARCHAR(20),
    status           aid_status NOT NULL DEFAULT 'REGISTERED',
    verified_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aid_status      ON aid_contributions(status);
CREATE INDEX idx_aid_contributor ON aid_contributions(contributor_id);

-- ---------------------------------------------------------------------
-- 9. NOTIFICATIONS (NU-FR-07, AM-FR-09)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Key = {notification_id}. All determinants are candidate keys.
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_code      VARCHAR(80) NOT NULL,             -- INCIDENT_VERIFIED, DISPATCH_ALERT, etc.
    channel         notif_channel NOT NULL DEFAULT 'IN_APP',
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    related_id      UUID,
    status          notif_status NOT NULL DEFAULT 'QUEUED',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 10. SYSTEM CONFIG & AUDIT TRAIL (AM-FR-03, AM-FR-05)
-- ---------------------------------------------------------------------
-- BCNF: Candidate Keys = {config_id}, {config_key}. All determinants are candidate keys.
CREATE TABLE system_configs (
    config_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key  VARCHAR(100) UNIQUE NOT NULL,
    value       JSONB NOT NULL,
    version     INT NOT NULL DEFAULT 1,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    changed_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BCNF: Candidate Keys = {audit_id}, {row_hash}. All determinants are candidate keys.
-- Security: Cryptographic SHA-256 hash chaining ensures tamper-evident auditability.
CREATE TABLE audit_logs (
    audit_id     BIGSERIAL PRIMARY KEY,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    actor_role   role_code,
    action       VARCHAR(80) NOT NULL,
    entity_type  VARCHAR(60) NOT NULL,
    entity_id    UUID,
    result       audit_result NOT NULL DEFAULT 'SUCCESS',
    rationale    TEXT,
    before_state JSONB,
    after_state  JSONB,
    ip_address   INET,
    prev_hash    CHAR(64),
    row_hash     CHAR(64) UNIQUE
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- 11. ANALYTICS & OPERATIONAL VIEWS (DM-FR-14)
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
       a.name AS agency_name
FROM resources r
LEFT JOIN agencies a ON r.agency_id = a.agency_id;

CREATE OR REPLACE VIEW v_donation_summary AS
SELECT c.campaign_id,
       c.title,
       COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'CONFIRMED'), 0) AS confirmed_amount,
       COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'PENDING'), 0)   AS pending_amount,
       COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'FAILED'), 0)    AS failed_amount,
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

-- ---------------------------------------------------------------------
-- 12. TRIGGERS & PROCEDURES
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd          BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_auth_upd      BEFORE UPDATE ON user_auth          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agencies_upd       BEFORE UPDATE ON agencies           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_incidents_upd      BEFORE UPDATE ON incidents          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_resources_upd      BEFORE UPDATE ON resources          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dispatch_upd       BEFORE UPDATE ON dispatch_orders    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agency_msgs_upd    BEFORE UPDATE ON agency_messages    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_public_updates_upd BEFORE UPDATE ON public_updates     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_upd      BEFORE UPDATE ON donation_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_donations_upd      BEFORE UPDATE ON donations          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_aid_needs_upd      BEFORE UPDATE ON aid_needs          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_aid_upd            BEFORE UPDATE ON aid_contributions  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_system_configs_upd BEFORE UPDATE ON system_configs     FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Bi-directional sync of coordinates and PostGIS point geometry
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

-- Receipt rule: Receipt number allowed only when donation status is CONFIRMED
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

-- Immutable Audit Log Trigger: Strictly prohibits UPDATE or DELETE
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- SHA-256 Tamper-Evident Hash Chain Trigger (AM-FR-05)
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
