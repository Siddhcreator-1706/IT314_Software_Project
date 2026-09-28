-- ============================================================================
-- IT314 - Disaster Response Coordination Hub
-- Neon PostgreSQL 15+
-- BCNF-oriented relational schema with application-managed authentication
-- ============================================================================
-- Design constraints derived from the SRS:
--   * Supported scenarios: CYCLONE, INDUSTRIAL_FIRE, URBAN_FLOODING
--   * AI is advisory; human decisions are separate and authoritative
--   * Explicit states + append-only histories
--   * No false success for payment, dispatch, notification or delivery
--   * Critical actions are auditable
--   * RBAC: NORMAL_USER, DISASTER_MGMT, APP_MGMT
--   * Donations and physical aid are independent of incident reporting
--   * Safe retries via idempotency keys
--   * Neon PostgreSQL; authentication is NOT Supabase Auth
--
-- BCNF notes:
--   1. Repeating / multivalued attributes are represented as child relations.
--   2. Scenario-specific attributes are separated into 1:1 relations.
--   3. Resource capabilities, notification channels, AI factors, etc. are
--      represented relationally instead of JSON documents.
--   4. Candidate keys are declared UNIQUE where applicable.
--   5. External provider payloads are stored as TEXT because they are opaque
--      integration artifacts rather than application-domain relations.
--
-- Run this script against a NEW Neon database.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 0. EXTENSIONS
-- --------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS postgis;

-- --------------------------------------------------------------------------
-- 1. SCHEMAS
-- --------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS app;

-- Keep the application schema separate from authentication infrastructure.
-- public remains available for compatibility, but domain tables live in app.

-- --------------------------------------------------------------------------
-- 2. ENUM TYPES
-- --------------------------------------------------------------------------

CREATE TYPE app.role_code AS ENUM (
    'NORMAL_USER',
    'DISASTER_MGMT',
    'APP_MGMT'
);

CREATE TYPE app.account_status AS ENUM (
    'ACTIVE',
    'LOCKED',
    'DISABLED',
    'PENDING_VERIFICATION'
);

CREATE TYPE app.scenario_type AS ENUM (
    'CYCLONE',
    'INDUSTRIAL_FIRE',
    'URBAN_FLOODING'
);

CREATE TYPE app.incident_status AS ENUM (
    'SUBMITTED',
    'NEEDS_INFORMATION',
    'VERIFIED',
    'REJECTED',
    'CLOSED'
);

CREATE TYPE app.verification_decision AS ENUM (
    'VERIFIED',
    'REJECTED',
    'NEEDS_INFORMATION'
);

CREATE TYPE app.priority_level AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW'
);

CREATE TYPE app.location_source AS ENUM (
    'GPS',
    'MAP_PIN',
    'MANUAL'
);

CREATE TYPE app.scan_status AS ENUM (
    'PENDING',
    'CLEAN',
    'QUARANTINED',
    'REJECTED',
    'FAILED'
);

CREATE TYPE app.ai_decision_action AS ENUM (
    'ACCEPTED',
    'MODIFIED',
    'REJECTED'
);

CREATE TYPE app.ai_rec_status AS ENUM (
    'GENERATED',
    'LOW_CONFIDENCE',
    'UNAVAILABLE',
    'UNSAFE_OUTPUT'
);

CREATE TYPE app.duplicate_relation AS ENUM (
    'CANDIDATE',
    'CONFIRMED_DUPLICATE',
    'LINKED',
    'MERGED',
    'NOT_DUPLICATE'
);

CREATE TYPE app.transaction_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'FAILED'
);

CREATE TYPE app.reconciliation_status AS ENUM (
    'UNRECONCILED',
    'MATCHED',
    'MISMATCH',
    'HELD',
    'RESOLVED'
);

CREATE TYPE app.aid_contribution_status AS ENUM (
    'REGISTERED',
    'PENDING_VERIFICATION',
    'VERIFIED',
    'REJECTED',
    'ALLOCATED',
    'IN_TRANSIT',
    'DELIVERED',
    'FAILED',
    'WITHDRAWN'
);

CREATE TYPE app.delivery_status AS ENUM (
    'CREATED',
    'PICKUP_SCHEDULED',
    'IN_TRANSIT',
    'DELIVERED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE app.resource_type AS ENUM (
    'TEAM',
    'VEHICLE',
    'SUPPLY',
    'SUPPORT'
);

CREATE TYPE app.resource_status AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'ASSIGNED',
    'UNAVAILABLE',
    'MAINTENANCE'
);

CREATE TYPE app.dispatch_status AS ENUM (
    'REQUESTED',
    'TRANSMITTED',
    'ACKNOWLEDGED',
    'DISPATCHED',
    'REJECTED',
    'FAILED',
    'CANCELLED',
    'COMPLETED'
);

CREATE TYPE app.message_status AS ENUM (
    'QUEUED',
    'SENT',
    'DELIVERED',
    'ACKNOWLEDGED',
    'FAILED'
);

CREATE TYPE app.notification_channel AS ENUM (
    'IN_APP',
    'EMAIL',
    'SMS',
    'PUSH'
);

CREATE TYPE app.notification_status AS ENUM (
    'QUEUED',
    'SENT',
    'DELIVERED',
    'FAILED',
    'RETRYING',
    'SUPPRESSED'
);

CREATE TYPE app.content_status AS ENUM (
    'DRAFT',
    'APPROVED',
    'PUBLISHED',
    'RETIRED'
);

CREATE TYPE app.audit_result AS ENUM (
    'SUCCESS',
    'FAILURE',
    'DENIED'
);

CREATE TYPE app.health_state AS ENUM (
    'UP',
    'DEGRADED',
    'DOWN',
    'UNKNOWN'
);

CREATE TYPE app.backup_status AS ENUM (
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'VERIFIED',
    'CORRUPT'
);

CREATE TYPE app.campaign_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'CLOSED'
);

CREATE TYPE app.config_value_type AS ENUM (
    'TEXT',
    'INTEGER',
    'DECIMAL',
    'BOOLEAN'
);

-- --------------------------------------------------------------------------
-- 3. COMMON FUNCTIONS
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION app.current_role_code()
RETURNS app.role_code
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(current_setting('app.role_code', true), '')::app.role_code;
$$;

-- Backend must call these at the beginning of every transaction handling an
-- authenticated request. SET LOCAL prevents identity leakage on pooled Neon
-- connections.
CREATE OR REPLACE FUNCTION app.set_request_identity(
    p_user_id UUID,
    p_role app.role_code
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.user_id', p_user_id::TEXT, true);
    PERFORM set_config('app.role_code', p_role::TEXT, true);
END;
$$;

-- --------------------------------------------------------------------------
-- 4. AUTHENTICATION SCHEMA - APPLICATION MANAGED
-- --------------------------------------------------------------------------

CREATE TABLE auth.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status app.account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    email_verified_at TIMESTAMPTZ,
    failed_login_count INTEGER NOT NULL DEFAULT 0
        CHECK (failed_login_count >= 0),
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE auth.sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_auth_sessions_user
    ON auth.sessions(user_id, expires_at DESC);

CREATE TABLE auth.login_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    email_tried CITEXT NOT NULL,
    user_id UUID REFERENCES auth.users(user_id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_login_attempts_email
    ON auth.login_attempts(email_tried, attempted_at DESC);

CREATE TABLE auth.email_verification_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_email_tokens_user
    ON auth.email_verification_tokens(user_id, expires_at);

CREATE TABLE auth.password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_reset_tokens_user
    ON auth.password_reset_tokens(user_id, expires_at);

CREATE TABLE auth.mfa_factors (
    mfa_factor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    factor_type VARCHAR(20) NOT NULL,
    secret_ciphertext BYTEA NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    UNIQUE (user_id, factor_type)
);

CREATE TABLE auth.mfa_challenges (
    challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mfa_factor_id UUID NOT NULL REFERENCES auth.mfa_factors(mfa_factor_id) ON DELETE CASCADE,
    challenge_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_mfa_challenges_factor
    ON auth.mfa_challenges(mfa_factor_id, expires_at);

CREATE TRIGGER trg_auth_users_updated_at
BEFORE UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- --------------------------------------------------------------------------
-- 5. APPLICATION IDENTITY / ROLES / AGENCIES
-- --------------------------------------------------------------------------

CREATE TABLE app.roles (
    role_id SMALLSERIAL PRIMARY KEY,
    code app.role_code NOT NULL UNIQUE,
    description TEXT NOT NULL
);

INSERT INTO app.roles(code, description) VALUES
('NORMAL_USER', 'Citizen / normal user'),
('DISASTER_MGMT', 'Authorised disaster-management staff'),
('APP_MGMT', 'Application administrator')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE app.agencies (
    agency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    agency_type VARCHAR(50) NOT NULL,
    contact_email CITEXT,
    contact_phone VARCHAR(20),
    api_endpoint TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(user_id) ON DELETE CASCADE,
    role_id SMALLINT NOT NULL REFERENCES app.roles(role_id),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    address_line TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(12),
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    staff_agency_id UUID REFERENCES app.agencies(agency_id),
    staff_designation VARCHAR(100),
    consent_given_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION app.validate_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_role app.role_code;
BEGIN
    SELECT code INTO v_role FROM app.roles WHERE role_id = NEW.role_id;
    IF NEW.staff_agency_id IS NOT NULL
       AND v_role NOT IN ('DISASTER_MGMT', 'APP_MGMT') THEN
        RAISE EXCEPTION 'Only staff/admin profiles may have staff_agency_id';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_profile_role
BEFORE INSERT OR UPDATE ON app.profiles
FOR EACH ROW EXECUTE FUNCTION app.validate_profile_role();

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON app.profiles
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE OR REPLACE FUNCTION app.record_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO app.user_role_history(user_id, from_role_id, to_role_id, changed_by, reason)
        VALUES (NEW.user_id, NULL, NEW.role_id, app.current_user_id(), 'Initial role assignment');
    ELSIF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
        INSERT INTO app.user_role_history(user_id, from_role_id, to_role_id, changed_by, reason)
        VALUES (NEW.user_id, OLD.role_id, NEW.role_id, app.current_user_id(), 'Role changed');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_role_history
AFTER INSERT OR UPDATE OF role_id ON app.profiles
FOR EACH ROW EXECUTE FUNCTION app.record_role_change();

CREATE INDEX idx_profiles_role ON app.profiles(role_id);
CREATE INDEX idx_profiles_agency ON app.profiles(staff_agency_id);

CREATE TABLE app.user_role_history (
    role_history_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    from_role_id SMALLINT REFERENCES app.roles(role_id),
    to_role_id SMALLINT NOT NULL REFERENCES app.roles(role_id),
    changed_by UUID REFERENCES auth.users(user_id),
    reason TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 6. INCIDENTS
-- --------------------------------------------------------------------------

CREATE TABLE app.incidents (
    incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_ref VARCHAR(30) NOT NULL UNIQUE,
    reporter_id UUID NOT NULL REFERENCES auth.users(user_id),
    scenario app.scenario_type NOT NULL,
    description TEXT NOT NULL,
    reported_urgency app.priority_level,
    people_affected INTEGER CHECK (people_affected >= 0),
    status app.incident_status NOT NULL DEFAULT 'SUBMITTED',
    verified_priority app.priority_level,
    priority_rationale TEXT,
    canonical_incident_id UUID REFERENCES app.incidents(incident_id),
    idempotency_key VARCHAR(100),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (reporter_id, idempotency_key)
);

CREATE INDEX idx_incidents_status_priority
    ON app.incidents(status, verified_priority);
CREATE INDEX idx_incidents_scenario
    ON app.incidents(scenario, submitted_at DESC);
CREATE INDEX idx_incidents_reporter
    ON app.incidents(reporter_id, submitted_at DESC);

CREATE TABLE app.incident_locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    source app.location_source NOT NULL,
    geom GEOGRAPHY(POINT, 4326),
    accuracy_m NUMERIC(8,2) CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
    address_text TEXT,
    landmark TEXT,
    normalised_address TEXT,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (geom IS NOT NULL OR address_text IS NOT NULL)
);

CREATE INDEX idx_incident_locations_geom
    ON app.incident_locations USING GIST(geom);
CREATE INDEX idx_incident_locations_current
    ON app.incident_locations(incident_id) WHERE is_current;

-- Scenario-specific relations. Each incident may have at most one detail row
-- for its scenario. Triggers enforce scenario/table consistency.

CREATE TABLE app.cyclone_details (
    incident_id UUID PRIMARY KEY REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    severity VARCHAR(50),
    shelter_needed BOOLEAN,
    affected_area_description TEXT
);

CREATE TABLE app.fire_details (
    incident_id UUID PRIMARY KEY REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    site_description TEXT,
    smoke_indicators TEXT,
    injuries_count INTEGER CHECK (injuries_count IS NULL OR injuries_count >= 0),
    access_constraints TEXT
);

CREATE TABLE app.flood_details (
    incident_id UUID PRIMARY KEY REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    water_level_m NUMERIC(8,2) CHECK (water_level_m IS NULL OR water_level_m >= 0),
    stranded_persons INTEGER CHECK (stranded_persons IS NULL OR stranded_persons >= 0),
    road_status TEXT
);

CREATE OR REPLACE FUNCTION app.validate_scenario_detail()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_scenario app.scenario_type;
BEGIN
    SELECT scenario INTO v_scenario
    FROM app.incidents
    WHERE incident_id = NEW.incident_id;

    IF TG_TABLE_NAME = 'cyclone_details' AND v_scenario <> 'CYCLONE' THEN
        RAISE EXCEPTION 'Incident % is not a CYCLONE incident', NEW.incident_id;
    ELSIF TG_TABLE_NAME = 'fire_details' AND v_scenario <> 'INDUSTRIAL_FIRE' THEN
        RAISE EXCEPTION 'Incident % is not an INDUSTRIAL_FIRE incident', NEW.incident_id;
    ELSIF TG_TABLE_NAME = 'flood_details' AND v_scenario <> 'URBAN_FLOODING' THEN
        RAISE EXCEPTION 'Incident % is not an URBAN_FLOODING incident', NEW.incident_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cyclone_details
BEFORE INSERT OR UPDATE ON app.cyclone_details
FOR EACH ROW EXECUTE FUNCTION app.validate_scenario_detail();

CREATE TRIGGER trg_validate_fire_details
BEFORE INSERT OR UPDATE ON app.fire_details
FOR EACH ROW EXECUTE FUNCTION app.validate_scenario_detail();

CREATE TRIGGER trg_validate_flood_details
BEFORE INSERT OR UPDATE ON app.flood_details
FOR EACH ROW EXECUTE FUNCTION app.validate_scenario_detail();

CREATE TABLE app.incident_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    from_status app.incident_status,
    to_status app.incident_status NOT NULL,
    changed_by UUID REFERENCES auth.users(user_id),
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_status_history
    ON app.incident_status_history(incident_id, changed_at);

CREATE TABLE app.evidence_files (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(user_id),
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_key TEXT NOT NULL UNIQUE,
    sha256 CHAR(64) NOT NULL,
    scan_state app.scan_status NOT NULL DEFAULT 'PENDING',
    scan_detail TEXT,
    moderation_flag BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_incident ON app.evidence_files(incident_id);

-- --------------------------------------------------------------------------
-- 7. VERIFICATION / AI / PRIORITY / DUPLICATES
-- --------------------------------------------------------------------------

CREATE TABLE app.verification_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES app.incidents(incident_id),
    decided_by UUID NOT NULL REFERENCES auth.users(user_id),
    decision app.verification_decision NOT NULL,
    rationale TEXT NOT NULL,
    info_requested TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_incident
    ON app.verification_decisions(incident_id, decided_at DESC);

CREATE TABLE app.ai_models (
    model_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    provider VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (name, version)
);

CREATE TABLE app.ai_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    model_id INTEGER REFERENCES app.ai_models(model_id),
    requested_by UUID REFERENCES auth.users(user_id),
    status app.ai_rec_status NOT NULL,
    suggested_scenario app.scenario_type,
    suggested_priority app.priority_level,
    confidence NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    uncertainty_note TEXT,
    guardrail_passed BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_recommendations_incident
    ON app.ai_recommendations(incident_id, created_at DESC);

CREATE TABLE app.ai_recommendation_factors (
    factor_id BIGSERIAL PRIMARY KEY,
    recommendation_id UUID NOT NULL REFERENCES app.ai_recommendations(recommendation_id) ON DELETE CASCADE,
    factor_name VARCHAR(100) NOT NULL,
    factor_value TEXT NOT NULL,
    contribution NUMERIC(8,5),
    UNIQUE (recommendation_id, factor_name)
);

CREATE TABLE app.ai_human_decisions (
    ai_decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES app.ai_recommendations(recommendation_id),
    decided_by UUID NOT NULL REFERENCES auth.users(user_id),
    action app.ai_decision_action NOT NULL,
    final_scenario app.scenario_type,
    final_priority app.priority_level,
    rationale TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_human_decisions_incident
    ON app.ai_human_decisions(incident_id, decided_at DESC);

CREATE TABLE app.priority_assignments (
    priority_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    priority app.priority_level NOT NULL,
    assigned_by UUID NOT NULL REFERENCES auth.users(user_id),
    rationale TEXT NOT NULL,
    based_on_ai_recommendation UUID REFERENCES app.ai_recommendations(recommendation_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_priority_incident
    ON app.priority_assignments(incident_id, assigned_at DESC);

CREATE TABLE app.incident_duplicate_links (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_a UUID NOT NULL REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    incident_b UUID NOT NULL REFERENCES app.incidents(incident_id) ON DELETE CASCADE,
    similarity NUMERIC(4,3) CHECK (similarity BETWEEN 0 AND 1),
    detected_by VARCHAR(20) NOT NULL CHECK (detected_by IN ('RULES', 'AI')),
    relation app.duplicate_relation NOT NULL DEFAULT 'CANDIDATE',
    reviewed_by UUID REFERENCES auth.users(user_id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (incident_a <> incident_b),
    CHECK (incident_a < incident_b),
    UNIQUE (incident_a, incident_b)
);

CREATE TABLE app.duplicate_match_factors (
    match_factor_id BIGSERIAL PRIMARY KEY,
    link_id UUID NOT NULL REFERENCES app.incident_duplicate_links(link_id) ON DELETE CASCADE,
    factor_type VARCHAR(30) NOT NULL,
    factor_value TEXT NOT NULL,
    score NUMERIC(5,4),
    UNIQUE (link_id, factor_type)
);

-- --------------------------------------------------------------------------
-- 8. RESOURCE MANAGEMENT
-- --------------------------------------------------------------------------

CREATE TABLE app.resource_capabilities (
    capability_code VARCHAR(60) PRIMARY KEY,
    description TEXT NOT NULL
);

INSERT INTO app.resource_capabilities(capability_code, description) VALUES
('BOAT', 'Water rescue boat'),
('MEDICAL', 'Medical response capability'),
('FIRE_SUPPRESSION', 'Fire suppression capability'),
('SEARCH_RESCUE', 'Search and rescue capability'),
('EVACUATION', 'Evacuation capability'),
('HEAVY_VEHICLE', 'Heavy vehicle capability'),
('SUPPLY_TRANSPORT', 'Supply transportation capability')
ON CONFLICT DO NOTHING;

CREATE TABLE app.resources (
    resource_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES app.agencies(agency_id),
    resource_type app.resource_type NOT NULL,
    name VARCHAR(150) NOT NULL,
    status app.resource_status NOT NULL DEFAULT 'AVAILABLE',
    home_geom GEOGRAPHY(POINT, 4326),
    current_geom GEOGRAPHY(POINT, 4326),
    location_updated_at TIMESTAMPTZ,
    quantity_total NUMERIC(12,2),
    quantity_available NUMERIC(12,2),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_total IS NULL OR quantity_total >= 0),
    CHECK (quantity_available IS NULL OR quantity_available >= 0),
    CHECK (quantity_total IS NULL OR quantity_available IS NULL OR quantity_available <= quantity_total)
);

CREATE INDEX idx_resources_status
    ON app.resources(resource_type, status);
CREATE INDEX idx_resources_current_geom
    ON app.resources USING GIST(current_geom);

CREATE TABLE app.resource_capability_assignments (
    resource_id UUID NOT NULL REFERENCES app.resources(resource_id) ON DELETE CASCADE,
    capability_code VARCHAR(60) NOT NULL REFERENCES app.resource_capabilities(capability_code),
    PRIMARY KEY (resource_id, capability_code)
);

CREATE TABLE app.map_layers (
    layer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    layer_type VARCHAR(50) NOT NULL,
    scenario app.scenario_type,
    geom GEOGRAPHY,
    source VARCHAR(100),
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE INDEX idx_map_layers_geom
    ON app.map_layers USING GIST(geom);

-- --------------------------------------------------------------------------
-- 9. DISPATCH / AGENCY COMMUNICATION
-- --------------------------------------------------------------------------

CREATE TABLE app.dispatch_orders (
    dispatch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_ref VARCHAR(30) NOT NULL UNIQUE,
    incident_id UUID NOT NULL REFERENCES app.incidents(incident_id),
    created_by UUID NOT NULL REFERENCES auth.users(user_id),
    receiving_agency_id UUID REFERENCES app.agencies(agency_id),
    status app.dispatch_status NOT NULL DEFAULT 'REQUESTED',
    instructions TEXT,
    priority app.priority_level NOT NULL,
    acknowledged_by VARCHAR(200),
    acknowledged_at TIMESTAMPTZ,
    failure_reason TEXT,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_incident ON app.dispatch_orders(incident_id);
CREATE INDEX idx_dispatch_status ON app.dispatch_orders(status);

CREATE TABLE app.resource_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES app.dispatch_orders(dispatch_id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES app.resources(resource_id),
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    assigned_by UUID NOT NULL REFERENCES auth.users(user_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at TIMESTAMPTZ,
    release_reason TEXT
);

CREATE UNIQUE INDEX uq_active_resource_assignment
    ON app.resource_assignments(resource_id)
    WHERE released_at IS NULL;

CREATE TABLE app.dispatch_events (
    event_id BIGSERIAL PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES app.dispatch_orders(dispatch_id) ON DELETE CASCADE,
    from_status app.dispatch_status,
    to_status app.dispatch_status NOT NULL,
    source VARCHAR(50) NOT NULL CHECK (source IN ('OPERATOR', 'AGENCY_API', 'SYSTEM')),
    actor_id UUID REFERENCES auth.users(user_id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_events
    ON app.dispatch_events(dispatch_id, occurred_at);

CREATE TABLE app.agency_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(user_id),
    incident_id UUID REFERENCES app.incidents(incident_id),
    dispatch_id UUID REFERENCES app.dispatch_orders(dispatch_id),
    subject VARCHAR(200),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.agency_message_recipients (
    message_id UUID NOT NULL REFERENCES app.agency_messages(message_id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES app.agencies(agency_id),
    status app.message_status NOT NULL DEFAULT 'QUEUED',
    acknowledged_at TIMESTAMPTZ,
    failure_reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, agency_id)
);

-- --------------------------------------------------------------------------
-- 10. PUBLIC SAFETY CONTENT / UPDATES
-- --------------------------------------------------------------------------

CREATE TABLE app.safety_content (
    content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario app.scenario_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    status app.content_status NOT NULL DEFAULT 'DRAFT',
    source_name VARCHAR(200),
    body TEXT NOT NULL,
    approved_by UUID REFERENCES auth.users(user_id),
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scenario, title, language, version)
);

CREATE TABLE app.public_updates (
    update_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES app.incidents(incident_id),
    scenario app.scenario_type,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    affected_area GEOGRAPHY,
    area_label VARCHAR(200),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    supersedes_id UUID REFERENCES app.public_updates(update_id),
    status app.content_status NOT NULL DEFAULT 'DRAFT',
    published_by UUID REFERENCES auth.users(user_id),
    published_at TIMESTAMPTZ,
    send_notification BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_public_updates_published
    ON app.public_updates(status, published_at DESC);

-- --------------------------------------------------------------------------
-- 11. MONETARY DONATIONS / PAYMENTS
-- --------------------------------------------------------------------------

CREATE TABLE app.donation_campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    scenario app.scenario_type,
    target_amount NUMERIC(14,2) CHECK (target_amount IS NULL OR target_amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status app.campaign_status NOT NULL DEFAULT 'DRAFT',
    approved_by UUID REFERENCES auth.users(user_id),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE app.donations (
    donation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES app.donation_campaigns(campaign_id),
    donor_id UUID REFERENCES auth.users(user_id),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status app.transaction_status NOT NULL DEFAULT 'PENDING',
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    donor_name VARCHAR(150),
    donor_email CITEXT,
    gateway_name VARCHAR(50),
    gateway_order_id VARCHAR(100),
    gateway_txn_ref VARCHAR(100),
    payment_method_type VARCHAR(30),
    failure_code VARCHAR(50),
    failure_message TEXT,
    recon_state app.reconciliation_status NOT NULL DEFAULT 'UNRECONCILED',
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (gateway_name, gateway_txn_ref),
    CHECK (
        status <> 'CONFIRMED'
        OR (gateway_txn_ref IS NOT NULL AND confirmed_at IS NOT NULL)
    )
);

CREATE INDEX idx_donations_status ON app.donations(status, created_at DESC);
CREATE INDEX idx_donations_campaign ON app.donations(campaign_id, status);
CREATE INDEX idx_donations_donor ON app.donations(donor_id);

CREATE TABLE app.payment_callbacks (
    callback_id BIGSERIAL PRIMARY KEY,
    donation_id UUID REFERENCES app.donations(donation_id),
    gateway_name VARCHAR(50) NOT NULL,
    event_type VARCHAR(60),
    signature_valid BOOLEAN NOT NULL,
    raw_payload TEXT NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    process_result VARCHAR(30)
        CHECK (process_result IN ('APPLIED', 'IGNORED_DUPLICATE', 'REJECTED'))
);

CREATE INDEX idx_payment_callbacks_donation
    ON app.payment_callbacks(donation_id, received_at DESC);

CREATE TABLE app.donation_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    donation_id UUID NOT NULL REFERENCES app.donations(donation_id) ON DELETE CASCADE,
    from_status app.transaction_status,
    to_status app.transaction_status NOT NULL,
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.reconciliation_records (
    recon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID REFERENCES app.donations(donation_id),
    gateway_amount NUMERIC(14,2),
    app_amount NUMERIC(14,2),
    result app.reconciliation_status NOT NULL,
    mismatch_detail TEXT,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by UUID REFERENCES auth.users(user_id),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE app.receipts (
    receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL UNIQUE REFERENCES app.donations(donation_id),
    receipt_no VARCHAR(40) NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    document_key TEXT
);

-- --------------------------------------------------------------------------
-- 12. PHYSICAL AID
-- --------------------------------------------------------------------------

CREATE TABLE app.aid_needs (
    need_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES app.incidents(incident_id),
    campaign_id UUID REFERENCES app.donation_campaigns(campaign_id),
    aid_type VARCHAR(80) NOT NULL,
    quantity_required NUMERIC(12,2) NOT NULL CHECK (quantity_required > 0),
    quantity_fulfilled NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity_fulfilled >= 0),
    unit VARCHAR(30) NOT NULL,
    delivery_geom GEOGRAPHY(POINT, 4326),
    delivery_address TEXT,
    needed_by TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(user_id),
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_fulfilled <= quantity_required)
);

CREATE TABLE app.aid_contributions (
    contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id UUID NOT NULL REFERENCES auth.users(user_id),
    aid_type VARCHAR(80) NOT NULL,
    description TEXT,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(30) NOT NULL,
    condition_desc VARCHAR(100),
    expiry_date DATE,
    pickup_address TEXT,
    pickup_geom GEOGRAPHY(POINT, 4326),
    contact_phone VARCHAR(20),
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,
    status app.aid_contribution_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_by UUID REFERENCES auth.users(user_id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (available_until IS NULL OR available_from IS NULL OR available_until > available_from)
);

CREATE INDEX idx_aid_contributions_status
    ON app.aid_contributions(status);
CREATE INDEX idx_aid_contributions_contributor
    ON app.aid_contributions(contributor_id);

CREATE TABLE app.aid_contribution_history (
    history_id BIGSERIAL PRIMARY KEY,
    contribution_id UUID NOT NULL REFERENCES app.aid_contributions(contribution_id) ON DELETE CASCADE,
    from_status app.aid_contribution_status,
    to_status app.aid_contribution_status NOT NULL,
    changed_by UUID REFERENCES auth.users(user_id),
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.aid_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_id UUID NOT NULL REFERENCES app.aid_contributions(contribution_id),
    need_id UUID NOT NULL REFERENCES app.aid_needs(need_id),
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    allocated_by UUID NOT NULL REFERENCES auth.users(user_id),
    status app.aid_contribution_status NOT NULL DEFAULT 'ALLOCATED',
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.delivery_tasks (
    delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES app.aid_allocations(allocation_id),
    assigned_resource_id UUID REFERENCES app.resources(resource_id),
    status app.delivery_status NOT NULL DEFAULT 'CREATED',
    scheduled_pickup TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    received_by VARCHAR(150),
    confirmed_by UUID REFERENCES auth.users(user_id),
    failure_reason TEXT,
    attempt_no INTEGER NOT NULL DEFAULT 1 CHECK (attempt_no > 0),
    CHECK (
        status <> 'DELIVERED'
        OR (delivered_at IS NOT NULL AND confirmed_by IS NOT NULL)
    )
);

CREATE TABLE app.delivery_events (
    event_id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES app.delivery_tasks(delivery_id) ON DELETE CASCADE,
    status app.delivery_status NOT NULL,
    note TEXT,
    actor_id UUID REFERENCES auth.users(user_id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 13. NOTIFICATIONS
-- --------------------------------------------------------------------------

CREATE TABLE app.notification_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(80) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    status app.content_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES auth.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_code, language, version)
);

CREATE TABLE app.notification_routing_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code VARCHAR(80) NOT NULL,
    channel app.notification_channel NOT NULL,
    role_id SMALLINT REFERENCES app.roles(role_id),
    priority app.priority_level,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (event_code, channel, role_id, priority)
);

CREATE TABLE app.notification_preferences (
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    channel app.notification_channel NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, channel)
);

CREATE TABLE app.notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    template_id UUID REFERENCES app.notification_templates(template_id),
    channel app.notification_channel NOT NULL,
    status app.notification_status NOT NULL DEFAULT 'QUEUED',
    related_incident_id UUID REFERENCES app.incidents(incident_id),
    related_donation_id UUID REFERENCES app.donations(donation_id),
    related_delivery_id UUID REFERENCES app.delivery_tasks(delivery_id),
    provider_message_id VARCHAR(150),
    failure_reason TEXT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0)
);

CREATE INDEX idx_notifications_user
    ON app.notifications(user_id, queued_at DESC);
CREATE INDEX idx_notifications_retry
    ON app.notifications(status, queued_at);

-- --------------------------------------------------------------------------
-- 14. SYSTEM CONFIG / AUDIT / SECURITY / MONITORING / RECOVERY
-- --------------------------------------------------------------------------

CREATE TABLE app.system_configurations (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(120) NOT NULL UNIQUE,
    value_type app.config_value_type NOT NULL,
    value_text TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    changed_by UUID REFERENCES auth.users(user_id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES auth.users(user_id),
    actor_role app.role_code,
    action_code VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    result app.audit_result NOT NULL,
    rationale TEXT,
    request_id UUID,
    ip_address INET,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity
    ON app.audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_actor
    ON app.audit_logs(actor_id, occurred_at DESC);
CREATE INDEX idx_audit_action
    ON app.audit_logs(action_code, occurred_at DESC);

CREATE TABLE app.audit_field_changes (
    audit_change_id BIGSERIAL PRIMARY KEY,
    audit_id BIGINT NOT NULL REFERENCES app.audit_logs(audit_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    UNIQUE (audit_id, field_name)
);

CREATE TABLE app.security_events (
    security_event_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(user_id),
    event_type VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    ip_address INET,
    description TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.integrations (
    integration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_code VARCHAR(80) NOT NULL UNIQUE,
    integration_type VARCHAR(50) NOT NULL,
    endpoint TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.integration_health_checks (
    health_check_id BIGSERIAL PRIMARY KEY,
    integration_id UUID NOT NULL REFERENCES app.integrations(integration_id) ON DELETE CASCADE,
    state app.health_state NOT NULL,
    latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    detail TEXT
);

CREATE INDEX idx_integration_health_service
    ON app.integration_health_checks(integration_id, checked_at DESC);

CREATE TABLE app.backups (
    backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_reference TEXT NOT NULL UNIQUE,
    status app.backup_status NOT NULL DEFAULT 'RUNNING',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
    checksum CHAR(64),
    failure_reason TEXT
);

CREATE TABLE app.restore_operations (
    restore_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID NOT NULL REFERENCES app.backups(backup_id),
    initiated_by UUID NOT NULL REFERENCES auth.users(user_id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    success BOOLEAN,
    failure_reason TEXT
);

CREATE TABLE app.idempotency_keys (
    idempotency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(user_id),
    operation_code VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(150) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_status INTEGER,
    response_reference UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (actor_id, operation_code, idempotency_key)
);

CREATE INDEX idx_idempotency_expiry
    ON app.idempotency_keys(expires_at);

-- --------------------------------------------------------------------------
-- 15. UPDATED_AT TRIGGERS
-- --------------------------------------------------------------------------

CREATE TRIGGER trg_incidents_updated_at
BEFORE UPDATE ON app.incidents
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_resources_updated_at
BEFORE UPDATE ON app.resources
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_dispatch_orders_updated_at
BEFORE UPDATE ON app.dispatch_orders
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_donations_updated_at
BEFORE UPDATE ON app.donations
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_aid_contributions_updated_at
BEFORE UPDATE ON app.aid_contributions
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_safety_content_updated_at
BEFORE UPDATE ON app.safety_content
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- --------------------------------------------------------------------------
-- 16. AUTH / PROFILE CREATION
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.create_normal_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, auth, pg_temp
AS $$
DECLARE
    v_role_id SMALLINT;
BEGIN
    SELECT role_id INTO v_role_id
    FROM app.roles
    WHERE code = 'NORMAL_USER';

    INSERT INTO app.profiles(user_id, role_id, full_name)
    VALUES (NEW.user_id, v_role_id, COALESCE(split_part(NEW.email::TEXT, '@', 1), 'User'))
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_user_default_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app.create_normal_user_profile();

-- --------------------------------------------------------------------------
-- 17. BASIC DOMAIN INTEGRITY TRIGGERS
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.validate_incident_close()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'CLOSED' AND NEW.closed_at IS NULL THEN
        NEW.closed_at := now();
    END IF;
    IF NEW.status <> 'CLOSED' AND NEW.closed_at IS NOT NULL THEN
        NEW.closed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_close
BEFORE INSERT OR UPDATE ON app.incidents
FOR EACH ROW EXECUTE FUNCTION app.validate_incident_close();

CREATE OR REPLACE FUNCTION app.validate_aid_allocation_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_contribution_qty NUMERIC(12,2);
    v_allocated_qty NUMERIC(12,2);
BEGIN
    SELECT quantity INTO v_contribution_qty
    FROM app.aid_contributions
    WHERE contribution_id = NEW.contribution_id
    FOR UPDATE;

    SELECT COALESCE(SUM(quantity), 0) INTO v_allocated_qty
    FROM app.aid_allocations
    WHERE contribution_id = NEW.contribution_id
      AND allocation_id <> COALESCE(NEW.allocation_id, gen_random_uuid());

    IF v_allocated_qty + NEW.quantity > v_contribution_qty THEN
        RAISE EXCEPTION 'Aid allocation exceeds contribution quantity';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_aid_allocation_quantity
BEFORE INSERT OR UPDATE ON app.aid_allocations
FOR EACH ROW EXECUTE FUNCTION app.validate_aid_allocation_quantity();

-- --------------------------------------------------------------------------
-- 18. APPEND-ONLY STATE HISTORY TRIGGERS
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.record_incident_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO app.incident_status_history(incident_id, from_status, to_status, changed_by, reason)
        VALUES (NEW.incident_id, NULL, NEW.status, app.current_user_id(), 'Initial incident state');
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO app.incident_status_history(incident_id, from_status, to_status, changed_by, reason)
        VALUES (NEW.incident_id, OLD.status, NEW.status, app.current_user_id(), 'Incident status changed');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_status_history
AFTER INSERT OR UPDATE OF status ON app.incidents
FOR EACH ROW EXECUTE FUNCTION app.record_incident_status_change();

CREATE OR REPLACE FUNCTION app.record_donation_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO app.donation_status_history(donation_id, from_status, to_status, reason)
        VALUES (NEW.donation_id, NULL, NEW.status, 'Initial donation state');
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO app.donation_status_history(donation_id, from_status, to_status, reason)
        VALUES (NEW.donation_id, OLD.status, NEW.status, 'Donation status changed');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_donation_status_history
AFTER INSERT OR UPDATE OF status ON app.donations
FOR EACH ROW EXECUTE FUNCTION app.record_donation_status_change();

CREATE OR REPLACE FUNCTION app.record_aid_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO app.aid_contribution_history(contribution_id, from_status, to_status, changed_by, reason)
        VALUES (NEW.contribution_id, NULL, NEW.status, app.current_user_id(), 'Initial aid state');
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO app.aid_contribution_history(contribution_id, from_status, to_status, changed_by, reason)
        VALUES (NEW.contribution_id, OLD.status, NEW.status, app.current_user_id(), 'Aid status changed');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aid_status_history
AFTER INSERT OR UPDATE OF status ON app.aid_contributions
FOR EACH ROW EXECUTE FUNCTION app.record_aid_status_change();

-- --------------------------------------------------------------------------
-- 20. RLS HELPER FUNCTIONS
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.is_role(p_role app.role_code)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT app.current_role_code() = p_role;
$$;

CREATE OR REPLACE FUNCTION app.is_staff()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT app.current_role_code() IN ('DISASTER_MGMT', 'APP_MGMT');
$$;

CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT app.current_role_code() = 'APP_MGMT';
$$;

-- --------------------------------------------------------------------------
-- 20. RLS
-- --------------------------------------------------------------------------
-- RLS is useful only when the application DB role is not the table owner and
-- is not granted BYPASSRLS. The Node backend should set app.user_id/app.role_code
-- with SET LOCAL through app.set_request_identity() inside a transaction.

ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.incident_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.verification_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_human_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.priority_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.resource_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.dispatch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.dispatch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agency_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agency_message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.safety_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.public_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.aid_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.aid_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.aid_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.delivery_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.system_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_select
ON app.profiles FOR SELECT
USING (user_id = app.current_user_id() OR app.is_admin());

CREATE POLICY profiles_self_update
ON app.profiles FOR UPDATE
USING (user_id = app.current_user_id())
WITH CHECK (user_id = app.current_user_id());

CREATE POLICY profiles_admin_all
ON app.profiles FOR ALL
USING (app.is_admin())
WITH CHECK (app.is_admin());

CREATE POLICY incidents_owner_select
ON app.incidents FOR SELECT
USING (reporter_id = app.current_user_id() OR app.is_staff());

CREATE POLICY incidents_owner_insert
ON app.incidents FOR INSERT
WITH CHECK (reporter_id = app.current_user_id());

CREATE POLICY incidents_staff_update
ON app.incidents FOR UPDATE
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY incident_locations_select
ON app.incident_locations FOR SELECT
USING (
    app.is_staff()
    OR EXISTS (
        SELECT 1 FROM app.incidents i
        WHERE i.incident_id = incident_locations.incident_id
          AND i.reporter_id = app.current_user_id()
    )
);

CREATE POLICY incident_locations_owner_insert
ON app.incident_locations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app.incidents i
        WHERE i.incident_id = incident_locations.incident_id
          AND i.reporter_id = app.current_user_id()
    )
    OR app.is_staff()
);

CREATE POLICY evidence_select
ON app.evidence_files FOR SELECT
USING (
    app.is_staff()
    OR uploaded_by = app.current_user_id()
    OR EXISTS (
        SELECT 1 FROM app.incidents i
        WHERE i.incident_id = evidence_files.incident_id
          AND i.reporter_id = app.current_user_id()
    )
);

CREATE POLICY evidence_insert
ON app.evidence_files FOR INSERT
WITH CHECK (uploaded_by = app.current_user_id());

CREATE POLICY staff_verification_all
ON app.verification_decisions FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_ai_recommendations_all
ON app.ai_recommendations FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_ai_decisions_all
ON app.ai_human_decisions FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_priority_all
ON app.priority_assignments FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_resources_all
ON app.resources FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_resource_assignments_all
ON app.resource_assignments FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_dispatch_all
ON app.dispatch_orders FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_dispatch_events_all
ON app.dispatch_events FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_agency_messages_all
ON app.agency_messages FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY staff_agency_recipients_all
ON app.agency_message_recipients FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY safety_content_public_read
ON app.safety_content FOR SELECT
USING (status = 'PUBLISHED' OR app.is_staff());

CREATE POLICY safety_content_staff_manage
ON app.safety_content FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY public_updates_public_read
ON app.public_updates FOR SELECT
USING (status = 'PUBLISHED' OR app.is_staff());

CREATE POLICY public_updates_staff_manage
ON app.public_updates FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY campaigns_public_read
ON app.donation_campaigns FOR SELECT
USING (status IN ('ACTIVE', 'PAUSED') OR app.is_staff());

CREATE POLICY campaigns_staff_manage
ON app.donation_campaigns FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY donations_owner_select
ON app.donations FOR SELECT
USING (donor_id = app.current_user_id() OR app.is_staff());

CREATE POLICY donations_owner_insert
ON app.donations FOR INSERT
WITH CHECK (donor_id = app.current_user_id() OR donor_id IS NULL);

CREATE POLICY donations_staff_manage
ON app.donations FOR UPDATE
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY receipts_owner_select
ON app.receipts FOR SELECT
USING (
    app.is_staff()
    OR EXISTS (
        SELECT 1 FROM app.donations d
        WHERE d.donation_id = receipts.donation_id
          AND d.donor_id = app.current_user_id()
    )
);

CREATE POLICY aid_needs_staff_all
ON app.aid_needs FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY aid_contributions_owner_select
ON app.aid_contributions FOR SELECT
USING (contributor_id = app.current_user_id() OR app.is_staff());

CREATE POLICY aid_contributions_owner_insert
ON app.aid_contributions FOR INSERT
WITH CHECK (contributor_id = app.current_user_id());

CREATE POLICY aid_contributions_staff_update
ON app.aid_contributions FOR UPDATE
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY aid_allocations_staff_all
ON app.aid_allocations FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY delivery_staff_all
ON app.delivery_tasks FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY delivery_events_staff_all
ON app.delivery_events FOR ALL
USING (app.is_staff())
WITH CHECK (app.is_staff());

CREATE POLICY notification_preferences_self
ON app.notification_preferences FOR ALL
USING (user_id = app.current_user_id())
WITH CHECK (user_id = app.current_user_id());

CREATE POLICY notifications_self
ON app.notifications FOR SELECT
USING (user_id = app.current_user_id() OR app.is_staff());

CREATE POLICY config_admin
ON app.system_configurations FOR ALL
USING (app.is_admin())
WITH CHECK (app.is_admin());

CREATE POLICY audit_admin_read
ON app.audit_logs FOR SELECT
USING (app.is_admin());

-- Additional staff/admin policies for operational and immutable records.

ALTER TABLE app.incident_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.donation_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payment_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.aid_contribution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.duplicate_match_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.map_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.integration_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.restore_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY incident_history_read
ON app.incident_status_history FOR SELECT
USING (app.is_staff() OR EXISTS (
    SELECT 1 FROM app.incidents i
    WHERE i.incident_id = incident_status_history.incident_id
      AND i.reporter_id = app.current_user_id()
));

CREATE POLICY donation_history_read
ON app.donation_status_history FOR SELECT
USING (app.is_staff() OR EXISTS (
    SELECT 1 FROM app.donations d
    WHERE d.donation_id = donation_status_history.donation_id
      AND d.donor_id = app.current_user_id()
));

CREATE POLICY payment_callbacks_staff
ON app.payment_callbacks FOR ALL
USING (app.is_staff()) WITH CHECK (app.is_staff());

CREATE POLICY reconciliation_staff
ON app.reconciliation_records FOR ALL
USING (app.is_staff()) WITH CHECK (app.is_staff());

CREATE POLICY aid_history_read
ON app.aid_contribution_history FOR SELECT
USING (app.is_staff() OR EXISTS (
    SELECT 1 FROM app.aid_contributions c
    WHERE c.contribution_id = aid_contribution_history.contribution_id
      AND c.contributor_id = app.current_user_id()
));

CREATE POLICY duplicate_factors_staff
ON app.duplicate_match_factors FOR ALL
USING (app.is_staff()) WITH CHECK (app.is_staff());

CREATE POLICY map_layers_staff
ON app.map_layers FOR ALL
USING (app.is_staff()) WITH CHECK (app.is_staff());

CREATE POLICY integrations_admin
ON app.integrations FOR ALL
USING (app.is_admin()) WITH CHECK (app.is_admin());

CREATE POLICY integration_health_admin
ON app.integration_health_checks FOR SELECT
USING (app.is_admin());

CREATE POLICY security_events_admin
ON app.security_events FOR SELECT
USING (app.is_admin());

CREATE POLICY backups_admin
ON app.backups FOR ALL
USING (app.is_admin()) WITH CHECK (app.is_admin());

CREATE POLICY restore_admin
ON app.restore_operations FOR ALL
USING (app.is_admin()) WITH CHECK (app.is_admin());

CREATE POLICY idempotency_owner
ON app.idempotency_keys FOR ALL
USING (actor_id = app.current_user_id() OR app.is_admin())
WITH CHECK (actor_id = app.current_user_id() OR app.is_admin());

-- --------------------------------------------------------------------------
-- 21. PRIVILEGES
-- --------------------------------------------------------------------------
-- Do not grant application clients direct access to auth password/token tables.
-- The backend should use a restricted database role and stored procedures where
-- appropriate. Migration/owner role remains separate.

REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth FROM PUBLIC;

REVOKE ALL ON SCHEMA app FROM PUBLIC;

-- --------------------------------------------------------------------------
-- 22. SEED DATA
-- --------------------------------------------------------------------------

INSERT INTO app.resource_capabilities(capability_code, description) VALUES
('WATER_PUMP', 'Water pumping equipment'),
('EMERGENCY_MEDICAL', 'Emergency medical response'),
('COMMUNICATION', 'Emergency communication support')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 23. SCHEMA VERSION
-- --------------------------------------------------------------------------

CREATE TABLE app.schema_versions (
    version_id INTEGER PRIMARY KEY,
    version_label VARCHAR(50) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    description TEXT NOT NULL
);

INSERT INTO app.schema_versions(version_id, version_label, description)
VALUES (
    1,
    '1.0.0-neon-bcnf',
    'Initial Neon PostgreSQL BCNF-oriented Disaster Response Coordination Hub schema'
);

COMMIT;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
