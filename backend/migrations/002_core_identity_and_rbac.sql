-- Migration 002: Core Identity, RBAC, Sessions & Security Reference
-- Traceability: NU-FR-01/02, DM-FR-01, AM-FR-01/02, EH-02

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

CREATE TABLE users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id        SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    email          CITEXT UNIQUE NOT NULL,
    phone          VARCHAR(20),
    password_hash  TEXT NOT NULL,
    status         account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    consent_given_at TIMESTAMPTZ,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE agencies (
    agency_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    agency_type   VARCHAR(50) NOT NULL,
    contact_email CITEXT,
    contact_phone VARCHAR(20),
    api_endpoint  TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
    user_id       UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    full_name     VARCHAR(150) NOT NULL,
    address_line  TEXT,
    city          VARCHAR(100),
    state         VARCHAR(100),
    postal_code   VARCHAR(12),
    preferred_language VARCHAR(10) DEFAULT 'en',
    staff_agency_id UUID REFERENCES agencies(agency_id) ON DELETE SET NULL,
    staff_designation VARCHAR(100),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mfa_factors (
    mfa_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    factor_type VARCHAR(20) NOT NULL,
    secret_enc  BYTEA NOT NULL,
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

CREATE TABLE login_attempts (
    attempt_id   BIGSERIAL PRIMARY KEY,
    email_tried  CITEXT,
    user_id      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    success      BOOLEAN NOT NULL,
    ip_address   INET,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_email ON login_attempts(email_tried, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, attempted_at DESC);
