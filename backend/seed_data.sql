-- =====================================================================
-- Disaster Response Coordination Hub (DRCH) - IT314 Software Engineering
-- Baseline Database Seed Data
--
-- Traceability:
--   * SRS Section 14 (Stakeholder Responsibilities and System Summary)
--   * AM-FR-02 (Account & Role Management / RBAC)
--   * AM-FR-03 (Configuration Management)
--   * AM-FR-09 (Notification Configuration)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. BASELINE ROLES (SRS Section 2 & 14)
-- ---------------------------------------------------------------------
INSERT INTO roles (code, description) VALUES
 ('NORMAL_USER',  'Citizen: report incidents, track timeline, donate money, contribute physical aid'),
 ('DISASTER_MGMT','Operational staff: review, verify, triage, dispatch resources, coordinate agencies, publish verified updates'),
 ('APP_MGMT',     'Platform administrator: accounts, RBAC, system config, monitoring, audit, backups, security')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. GRANULAR PERMISSIONS (Mapped to FR IDs)
-- ---------------------------------------------------------------------
INSERT INTO permissions (code, description) VALUES
 -- Normal User Permissions (NU-FR-01..10)
 ('INCIDENT_REPORT',        'Submit emergency incident reports (NU-FR-03)'),
 ('INCIDENT_VIEW_OWN',      'View own submitted incident history and status (NU-FR-06)'),
 ('EVIDENCE_UPLOAD',        'Upload supporting images and evidence files (NU-FR-05)'),
 ('DONATION_CREATE',        'Make monetary relief donations via payment gateway (NU-FR-09)'),
 ('AID_CONTRIBUTE',         'Register physical aid relief supplies (NU-FR-10)'),
 
 -- Disaster Management Permissions (DM-FR-01..14)
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
 
 -- Application Management Permissions (AM-FR-01..10)
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

-- ---------------------------------------------------------------------
-- 3. ROLE-PERMISSION MAPPINGS (Enforcing Least Privilege)
-- ---------------------------------------------------------------------

-- 3.1 Normal User Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'NORMAL_USER'
  AND p.code IN (
    'INCIDENT_REPORT', 'INCIDENT_VIEW_OWN', 'EVIDENCE_UPLOAD',
    'DONATION_CREATE', 'AID_CONTRIBUTE'
  )
ON CONFLICT DO NOTHING;

-- 3.2 Disaster Management Permissions
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

-- 3.3 Application Management Permissions
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

-- ---------------------------------------------------------------------
-- 4. BASELINE AGENCIES REFERENCE DATA (SRS Section 2, 7.5)
-- ---------------------------------------------------------------------
INSERT INTO agencies (name, agency_type, contact_email, contact_phone, is_active) VALUES
 ('National Disaster Response Force (NDRF)', 'NDRF',      'ops@ndrf.gov.in',      '1078',        TRUE),
 ('State Emergency Operations Centre (SEOC)', 'MUNICIPAL', 'control@seoc.state.gov.in', '1070', TRUE),
 ('Fire and Emergency Services Command',      'FIRE',       'dispatch@fire.gov.in', '101',         TRUE),
 ('City Police Disaster Incident Cell',       'POLICE',     'incident@police.gov.in', '100',       TRUE),
 ('Emergency Medical & Ambulance Network',    'MEDICAL',    'triage@ems.gov.in',     '108',        TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. INITIAL NOTIFICATION TEMPLATES (NU-FR-07, AM-FR-09)
-- ---------------------------------------------------------------------
INSERT INTO notification_templates (code, channel, language, subject, body, version, is_active) VALUES
 ('INCIDENT_SUBMITTED', 'IN_APP', 'en', 'Incident Received', 'Your incident report {incident_ref} has been received and queued for review. Submission is not confirmation of verification or dispatch.', 1, TRUE),
 ('INCIDENT_VERIFIED',  'IN_APP', 'en', 'Incident Verified', 'Your incident report {incident_ref} has been reviewed and verified by disaster response staff.', 1, TRUE),
 ('DONATION_CONFIRMED', 'EMAIL',  'en', 'Donation Receipt - DRCH Relief Fund', 'Thank you for your generous contribution of INR {amount}. Transaction reference: {gateway_txn_ref}. Receipt No: {receipt_no}.', 1, TRUE),
 ('DISPATCH_ALERT',     'PUSH',   'en', 'Emergency Dispatch', 'Dispatch order {dispatch_ref} assigned for scenario {scenario}. Priority: {priority}. Immediate response requested.', 1, TRUE),
 ('AID_VERIFIED',       'SMS',    'en', 'Aid Contribution Verified', 'Your physical aid contribution {contribution_id} has been verified and queued for allocation to relief centers.', 1, TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. DEFAULT NOTIFICATION ROUTING RULES (AM-FR-09, AM-NFR-08)
-- ---------------------------------------------------------------------
INSERT INTO notification_routing_rules (event_code, channel, max_retries, retry_backoff_seconds, fallback_channel, is_active) VALUES
 ('INCIDENT_SUBMITTED', 'IN_APP', 3, 30, 'EMAIL', TRUE),
 ('INCIDENT_VERIFIED',  'IN_APP', 3, 30, 'SMS',   TRUE),
 ('DONATION_CONFIRMED', 'EMAIL',  5, 60, 'IN_APP', TRUE),
 ('DISPATCH_ALERT',     'PUSH',   5, 15, 'SMS',   TRUE),
 ('AID_VERIFIED',       'SMS',    3, 60, 'IN_APP', TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. INITIAL AI MODEL REGISTRATION (DM-FR-05)
-- ---------------------------------------------------------------------
INSERT INTO ai_models (name, version, provider, is_active) VALUES
 ('drch-incident-classifier', 'v1.2.0', 'DRCH Internal Triage Service', TRUE),
 ('drch-duplicate-detector',  'v1.0.4', 'DRCH Spatial-NLP Matcher',     TRUE)
ON CONFLICT (name, version) DO NOTHING;

COMMIT;
