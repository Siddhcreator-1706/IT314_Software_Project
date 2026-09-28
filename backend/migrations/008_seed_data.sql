-- Migration 008: Baseline Seed Data (Roles, Permissions, Configuration & Templates)
-- Traceability: SRS Section 14, AM-FR-02/03/09

INSERT INTO roles (code, description) VALUES
 ('NORMAL_USER',  'Citizen: report incidents, track timeline, donate money, contribute physical aid'),
 ('DISASTER_MGMT','Operational staff: review, verify, triage, dispatch resources, coordinate agencies, publish verified updates'),
 ('APP_MGMT',     'Platform administrator: accounts, RBAC, system config, monitoring, audit, backups, security')
ON CONFLICT (code) DO NOTHING;

-- Populate Granular Permissions mapped to FRs
INSERT INTO permissions (code, description) VALUES
 ('INCIDENT_REPORT',        'Submit emergency incident reports (NU-FR-03)'),
 ('INCIDENT_VIEW_OWN',      'View own submitted incident history and status (NU-FR-06)'),
 ('EVIDENCE_UPLOAD',        'Upload supporting images and evidence files (NU-FR-05)'),
 ('DONATION_CREATE',        'Make monetary relief donations via payment gateway (NU-FR-09)'),
 ('AID_CONTRIBUTE',         'Register physical aid relief supplies (NU-FR-10)'),
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

-- Map Permissions to Roles
-- 1) NORMAL_USER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'NORMAL_USER'
  AND p.code IN (
    'INCIDENT_REPORT', 'INCIDENT_VIEW_OWN', 'EVIDENCE_UPLOAD',
    'DONATION_CREATE', 'AID_CONTRIBUTE'
  )
ON CONFLICT DO NOTHING;

-- 2) DISASTER_MGMT
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

-- 3) APP_MGMT
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

-- Default Notification Templates (NU-FR-07, AM-FR-09)
INSERT INTO notification_templates (code, channel, language, subject, body, version, is_active) VALUES
 ('INCIDENT_SUBMITTED', 'IN_APP', 'en', 'Incident Received', 'Your incident report {incident_ref} has been received and queued for review. Submission is not confirmation of verification or dispatch.', 1, TRUE),
 ('INCIDENT_VERIFIED',  'IN_APP', 'en', 'Incident Verified', 'Your incident report {incident_ref} has been reviewed and verified by disaster response staff.', 1, TRUE),
 ('DONATION_CONFIRMED', 'EMAIL',  'en', 'Donation Receipt - DRCH Relief Fund', 'Thank you for your generous contribution of INR {amount}. Transaction reference: {gateway_txn_ref}. Receipt No: {receipt_no}.', 1, TRUE),
 ('DISPATCH_ALERT',     'PUSH',   'en', 'Emergency Dispatch', 'Dispatch order {dispatch_ref} assigned for scenario {scenario}. Priority: {priority}. Immediate response requested.', 1, TRUE)
ON CONFLICT DO NOTHING;
