-- Migration 001: Extensions and Domain ENUM Types
-- Derived from Final SRS (IT314) - Scenarios: Cyclone, Industrial Fire, Urban Flooding

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS postgis;    -- spatial geography types and indexes
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive emails & text

CREATE TYPE role_code             AS ENUM ('NORMAL_USER', 'DISASTER_MGMT', 'APP_MGMT');
CREATE TYPE account_status        AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED', 'PENDING_VERIFICATION');
CREATE TYPE scenario_type         AS ENUM ('CYCLONE', 'INDUSTRIAL_FIRE', 'URBAN_FLOODING');
CREATE TYPE incident_status       AS ENUM ('SUBMITTED', 'NEEDS_INFORMATION', 'VERIFIED', 'DISPATCHED', 'RESOLVED', 'CLOSED', 'REJECTED');
CREATE TYPE verification_decision AS ENUM ('VERIFIED', 'REJECTED', 'NEEDS_INFORMATION');
CREATE TYPE priority_level        AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE location_source       AS ENUM ('GPS', 'MAP_PIN', 'MANUAL');
CREATE TYPE scan_status           AS ENUM ('PENDING', 'CLEAN', 'QUARANTINED', 'REJECTED', 'FAILED');
CREATE TYPE ai_decision_action    AS ENUM ('ACCEPTED', 'MODIFIED', 'REJECTED');
CREATE TYPE ai_rec_status         AS ENUM ('GENERATED', 'LOW_CONFIDENCE', 'UNAVAILABLE', 'UNSAFE_OUTPUT');
CREATE TYPE duplicate_relation    AS ENUM ('CANDIDATE', 'CONFIRMED_DUPLICATE', 'LINKED', 'MERGED', 'NOT_DUPLICATE');
CREATE TYPE txn_status            AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');
CREATE TYPE recon_status          AS ENUM ('UNRECONCILED', 'MATCHED', 'MISMATCH', 'HELD', 'RESOLVED');
CREATE TYPE aid_status            AS ENUM ('REGISTERED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED',
                                           'ALLOCATED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'WITHDRAWN');
CREATE TYPE delivery_status       AS ENUM ('CREATED', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE resource_type         AS ENUM ('TEAM', 'VEHICLE', 'SUPPLY', 'SUPPORT');
CREATE TYPE resource_status       AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'UNAVAILABLE', 'MAINTENANCE');
CREATE TYPE dispatch_status       AS ENUM ('REQUESTED', 'TRANSMITTED', 'ACKNOWLEDGED', 'DISPATCHED',
                                           'REJECTED', 'FAILED', 'CANCELLED', 'COMPLETED');
CREATE TYPE msg_status            AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'FAILED');
CREATE TYPE notif_channel         AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');
CREATE TYPE notif_status          AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'SUPPRESSED');
CREATE TYPE content_status        AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'RETIRED');
CREATE TYPE audit_result          AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');
CREATE TYPE health_state          AS ENUM ('UP', 'DEGRADED', 'DOWN', 'UNKNOWN');
CREATE TYPE backup_status         AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'VERIFIED', 'CORRUPT');
CREATE TYPE campaign_status       AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');
