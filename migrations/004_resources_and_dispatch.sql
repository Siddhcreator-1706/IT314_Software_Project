-- Migration 004: Resources, Emergency Dispatch, Inter-Agency Messaging & GIS Map Layers
-- Traceability: DM-FR-07/08/09/10, DM-NFR-11, 7.5, 13.5

CREATE TABLE resources (
    resource_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id     UUID REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    type          resource_type NOT NULL,
    name          VARCHAR(150) NOT NULL,
    capability    JSONB,
    status        resource_status NOT NULL DEFAULT 'AVAILABLE',
    home_geom     GEOGRAPHY(Point,4326),
    current_geom  GEOGRAPHY(Point,4326),
    location_updated_at TIMESTAMPTZ,
    quantity_total NUMERIC(12,2),
    quantity_available NUMERIC(12,2),
    version       INT NOT NULL DEFAULT 1,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_available IS NULL OR quantity_available >= 0),
    CHECK (quantity_total IS NULL OR quantity_available <= quantity_total)
);
CREATE INDEX idx_resources_status ON resources(type, status);
CREATE INDEX idx_resources_geom ON resources USING GIST (current_geom);

CREATE TABLE dispatch_orders (
    dispatch_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_ref  VARCHAR(30) UNIQUE NOT NULL,
    incident_id   UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE RESTRICT,
    created_by    UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    receiving_agency_id UUID REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    status        dispatch_status NOT NULL DEFAULT 'REQUESTED',
    instructions  TEXT,
    priority      priority_level NOT NULL,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    failure_reason TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
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

CREATE TABLE dispatch_events (
    event_id     BIGSERIAL PRIMARY KEY,
    dispatch_id  UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    from_status  dispatch_status,
    to_status    dispatch_status NOT NULL,
    source       VARCHAR(50) NOT NULL,
    actor_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    payload      JSONB,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_events ON dispatch_events(dispatch_id, occurred_at);

CREATE TABLE agency_messages (
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

CREATE TABLE map_layers (
    layer_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    layer_type   VARCHAR(50) NOT NULL,
    scenario     scenario_type,
    geom         GEOGRAPHY(Geometry, 4326),
    properties   JSONB,
    source       VARCHAR(100),
    valid_from   TIMESTAMPTZ,
    valid_to     TIMESTAMPTZ,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_map_layers_geom ON map_layers USING GIST (geom);
