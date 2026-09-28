-- Migration 005: Public Content, Monetary Donations, Reconciliation & Physical Aid
-- Traceability: NU-FR-08/09/10, DM-FR-11/12/13, AM-FR-10, NU-NFR-07/08/10, 7.3, 7.4, 13.3, 13.4

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
    donor_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency     CHAR(3) NOT NULL DEFAULT 'INR',
    status       txn_status NOT NULL DEFAULT 'PENDING',
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    donor_name   VARCHAR(150),
    donor_email  CITEXT,
    gateway_name VARCHAR(50),
    gateway_order_id VARCHAR(100),
    gateway_txn_ref  VARCHAR(100),
    payment_method_type VARCHAR(30),
    failure_code VARCHAR(50),
    failure_message TEXT,
    recon_state  recon_status NOT NULL DEFAULT 'UNRECONCILED',
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (gateway_name, gateway_txn_ref),
    CHECK (status <> 'CONFIRMED' OR (gateway_txn_ref IS NOT NULL AND confirmed_at IS NOT NULL))
);
CREATE INDEX idx_donations_status ON donations(status, created_at DESC);
CREATE INDEX idx_donations_campaign ON donations(campaign_id, status);
CREATE INDEX idx_donations_donor ON donations(donor_id);

CREATE TABLE payment_callbacks (
    callback_id  BIGSERIAL PRIMARY KEY,
    donation_id  UUID REFERENCES donations(donation_id) ON DELETE CASCADE,
    gateway_name VARCHAR(50) NOT NULL,
    event_type   VARCHAR(60),
    signature_valid BOOLEAN NOT NULL,
    payload      JSONB NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    process_result VARCHAR(30)
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

CREATE TABLE reconciliation_records (
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

CREATE TABLE receipts (
    receipt_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id  UUID UNIQUE NOT NULL REFERENCES donations(donation_id) ON DELETE RESTRICT,
    receipt_no   VARCHAR(40) UNIQUE NOT NULL,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    document_key TEXT
);

CREATE TABLE fund_utilisations (
    utilisation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID NOT NULL REFERENCES donation_campaigns(campaign_id) ON DELETE RESTRICT,
    incident_id  UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    purpose      TEXT NOT NULL,
    approved_by  UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aid_needs (
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

CREATE TABLE aid_contributions (
    contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    aid_type        VARCHAR(80) NOT NULL,
    description     TEXT,
    quantity        NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit            VARCHAR(30) NOT NULL,
    condition_desc  VARCHAR(100),
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

CREATE TABLE aid_allocations (
    allocation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_id UUID NOT NULL REFERENCES aid_contributions(contribution_id) ON DELETE RESTRICT,
    need_id         UUID NOT NULL REFERENCES aid_needs(need_id) ON DELETE RESTRICT,
    quantity        NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    allocated_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status          aid_status NOT NULL DEFAULT 'ALLOCATED',
    allocated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delivery_tasks (
    delivery_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id  UUID NOT NULL REFERENCES aid_allocations(allocation_id) ON DELETE RESTRICT,
    assigned_resource_id UUID REFERENCES resources(resource_id) ON DELETE SET NULL,
    status         delivery_status NOT NULL DEFAULT 'CREATED',
    scheduled_pickup TIMESTAMPTZ,
    picked_up_at   TIMESTAMPTZ,
    delivered_at   TIMESTAMPTZ,
    received_by    VARCHAR(150),
    confirmed_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
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
