# DRCH Database Migrations

This directory contains versioned SQL migrations for the **Disaster Response Coordination Hub (DRCH)** database, derived from the IT314 Software Requirements Specification (SRS).

## Migration Index

| Order | File | Description | SRS Traceability |
| :--- | :--- | :--- | :--- |
| **001** | `001_extensions_and_enums.sql` | PostGIS, pgcrypto, citext, and domain Enums (Scenarios: Cyclone, Fire, Flooding) | System Principles, Scenarios |
| **002** | `002_core_identity_and_rbac.sql` | Users, Roles, Permissions, User Profiles, MFA, Sessions, Login Attempts | NU-FR-01/02, DM-FR-01, AM-FR-01/02, EH-02 |
| **003** | `003_incidents_and_triage.sql` | Incidents, Locations, Details, History, Evidence, Verification, AI Triage & Duplicates | NU-FR-03..06, DM-FR-02..06, DM-NFR-09/10, EH-01..06 |
| **004** | `004_resources_and_dispatch.sql` | Resources, Dispatch Orders, Resource Assignments, Inter-Agency Messaging, Map Layers | DM-FR-07..10, 7.5, 13.5 |
| **005** | `005_donations_and_aid.sql` | Safety Content, Public Updates, Donations, Callbacks, Reconciliation, Receipts, Physical Aid | NU-FR-08..10, DM-FR-11..13, AM-FR-10, 7.3, 7.4 |
| **006** | `006_notifications_and_admin.sql` | Notifications, Audit Logs, Security Events, Secrets, Health Monitoring, Backups, Idempotency | NU-FR-07, AM-FR-03..10, EH-12/13 |
| **007** | `007_views_functions_and_triggers.sql` | Analytical Views, updated_at Triggers, Geom Sync, Receipt Verification, Audit Immutability & Hash Chain | DM-FR-14, DM-NFR-06/11/12, AM-FR-05 |
| **008** | `008_seed_data.sql` | Baseline Roles, Granular Permissions, Role-Permission mappings, Initial Notification Templates | Section 14, AM-FR-02/09 |

---

## How to Apply Migrations

### Option 1: Automatic Initialization with Docker
In `docker-compose.yml`, the `migrations/` folder is mounted to `/docker-entrypoint-initdb.d/`. When starting the `postgres-postgis` container for the first time, PostgreSQL executes all scripts in numerical sequence automatically.

### Option 2: Using psql CLI
```bash
# Set your target connection
export PGDATABASE=drch_db
export PGUSER=postgres
export PGPASSWORD=password
export PGHOST=localhost
export PGPORT=5432

# Apply in sequence
for file in migrations/*.sql; do
    echo "Applying $file..."
    psql -f "$file"
done
```

### Option 3: Full Schema File
For a single combined execution, use the root [drch_schema.sql](../drch_schema.sql):
```bash
psql -h localhost -U postgres -d drch_db -f drch_schema.sql
```
