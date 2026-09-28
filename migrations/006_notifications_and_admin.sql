-- Migration 006: Notifications, Administration, Audit, Security, Health & Idempotency
-- Traceability: NU-FR-07, AM-FR-03..10, DM-NFR-06, AM-NFR-08/09, EH-12/13

CREATE TABLE notification_templates (
    template_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(80) NOT NULL,
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
    related_type VARCHAR(40),
    related_id   UUID,
    status       notif_status NOT NULL DEFAULT 'QUEUED',
    provider_ref VARCHAR(100),
    attempt_count INT NOT NULL DEFAULT 0,
    last_error   TEXT,
    dedupe_key   VARCHAR(150),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at      TIMESTAMPTZ,
    read_at      TIMESTAMPTZ,
    UNIQUE (user_id, channel, dedupe_key),
    CHECK (status NOT IN ('SENT', 'DELIVERED') OR sent_at IS NOT NULL)
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_retry ON notifications(status) WHERE status IN ('QUEUED', 'RETRYING');

CREATE TABLE system_configs (
    config_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key   VARCHAR(100) NOT NULL,
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

CREATE TABLE audit_logs (
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

CREATE TABLE security_events (
    event_id     BIGSERIAL PRIMARY KEY,
    event_type   VARCHAR(60) NOT NULL,
    severity     priority_level NOT NULL,
    user_id      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    details      JSONB,
    handled_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    handled_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE secret_rotations (
    rotation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_name  VARCHAR(100) NOT NULL,
    rotated_by   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    rotated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_due_at  TIMESTAMPTZ
);

CREATE TABLE integration_health (
    health_id    BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(80) NOT NULL,
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

CREATE TABLE backups (
    backup_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type  VARCHAR(20) NOT NULL,
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
    status       VARCHAR(20) NOT NULL,
    verification_note TEXT,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);

CREATE TABLE data_correction_tasks (
    task_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type    VARCHAR(40) NOT NULL,
    target_entity VARCHAR(60) NOT NULL,
    affected_count INT,
    justification TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    approved_by  UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    status       VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE retention_policies (
    policy_id    SERIAL PRIMARY KEY,
    entity_type  VARCHAR(60) UNIQUE NOT NULL,
    retain_days  INT NOT NULL,
    action_after VARCHAR(20) NOT NULL DEFAULT 'ARCHIVE'
);

CREATE TABLE idempotency_keys (
    key          VARCHAR(100) NOT NULL,
    scope        VARCHAR(50) NOT NULL,
    user_id      UUID REFERENCES users(user_id) ON DELETE CASCADE,
    request_hash CHAR(64) NOT NULL,
    response_ref UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, key)
);
