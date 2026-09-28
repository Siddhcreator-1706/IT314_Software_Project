-- Migration 007: Analytical Views, Stored Functions & Triggers
-- Traceability: DM-FR-14, DM-NFR-06/11/12, AM-FR-05, AM-NFR-09

-- 1. Analytics & Operational Views
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

-- 2. Stored Procedures and Triggers

-- 2.1 Updated_at timestamp triggers
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

-- 2.2 Incident Location Point Geolocation Synchronization
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

-- 2.3 Enforce No False Success: Receipt creation ONLY for confirmed donations (7.3, NU-FR-09)
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

-- 2.4 Audit Log Immutability Protection (AM-FR-05, DM-NFR-06)
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 2.5 Audit Log Cryptographic Hash-Chaining (AM-NFR-09)
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
