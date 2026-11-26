-- =====================================================================
-- DRCH - Migration 20: when a field team last reported its position
--
-- resources.current_geom was only ever set by a dispatcher editing the resource, so a team's marker on
-- the live map never followed the team. Field responders can now share their position while their team
-- has an active dispatch (POST /api/v1/field/location, or coordinates sent with a progress report).
-- This column records when that last happened, so the map can show how fresh a position is.
-- It is NULL for resources whose position was set by hand and never reported by a team.
-- =====================================================================

ALTER TABLE resources ADD COLUMN IF NOT EXISTS position_updated_at TIMESTAMPTZ;
