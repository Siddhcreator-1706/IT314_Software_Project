-- =====================================================================
-- Disaster Response Coordination Hub (DRCH) - IT314 Software Engineering
-- Baseline Database Seed Data - Minimized & Clean
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. BASELINE ROLES
-- ---------------------------------------------------------------------
INSERT INTO roles (code, description) VALUES
 ('NORMAL_USER',  'Citizen: report incidents, track timeline, donate money, contribute physical aid'),
 ('DISASTER_MGMT','Operational staff: review, verify, triage, dispatch resources, coordinate agencies, publish verified updates'),
 ('APP_MGMT',     'Platform administrator: accounts, RBAC, system config, monitoring, audit, backups, security')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. BASELINE AGENCIES REFERENCE DATA
-- ---------------------------------------------------------------------
INSERT INTO agencies (name, agency_type, contact_email, contact_phone, is_active) VALUES
 ('National Disaster Response Force (NDRF)', 'NDRF',      'ops@ndrf.gov.in',      '1078',        TRUE),
 ('State Emergency Operations Centre (SEOC)', 'MUNICIPAL', 'control@seoc.state.gov.in', '1070', TRUE),
 ('Fire and Emergency Services Command',      'FIRE',       'dispatch@fire.gov.in', '101',         TRUE),
 ('City Police Disaster Incident Cell',       'POLICE',     'incident@police.gov.in', '100',       TRUE),
 ('Emergency Medical & Ambulance Network',    'MEDICAL',    'triage@ems.gov.in',     '108',        TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. INITIAL BOOTSTRAP ADMIN & AUTH CREDENTIALS
-- ---------------------------------------------------------------------
INSERT INTO users (user_id, role_id, email, phone, full_name, status)
SELECT 'a0000000-0000-0000-0000-000000000001'::uuid,
       r.role_id,
       'admin@drch.gov.in',
       '+919999999999',
       'System Administrator',
       'ACTIVE'
FROM roles r WHERE r.code = 'APP_MGMT'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_auth (user_id, password_hash, mfa_enabled)
SELECT u.user_id,
       '$argon2id$v=19$m=65536,t=3,p=4$drch_bootstrap_admin_hash',
       FALSE
FROM users u WHERE u.email = 'admin@drch.gov.in'
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. SYSTEM BASELINE CONFIGURATION
-- ---------------------------------------------------------------------
INSERT INTO system_configs (config_key, value, version, is_active, changed_by)
SELECT 'SCENARIOS_SUPPORTED',
       '{"scenarios": ["CYCLONE", "INDUSTRIAL_FIRE", "URBAN_FLOODING"], "max_upload_size_mb": 25, "allowed_evidence_types": ["image/jpeg", "image/png", "video/mp4", "application/pdf"]}'::jsonb,
       1, TRUE, u.user_id
FROM users u WHERE u.email = 'admin@drch.gov.in'
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
