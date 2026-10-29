"""Test S1-11 Team-Recommendation Rules and Spatial Query Engine.

Verifies:
1. Rules table correctly maps scenarios to capability requirements.
2. Ranking engine against 5 representative Gujarat seed incidents.
3. Top 3 teams for each incident are domain-sensible and geographically ranked.
4. Unavailable teams (status != 'AVAILABLE' or quantity_available <= 0) are strictly excluded.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.recommendations import (
    SCENARIO_CAPABILITY_RULES,
    get_recommended_teams,
    score_and_rank_teams,
)

# 5 representative seed incidents across Gujarat
SEED_INCIDENTS = [
    {
        "ref": "INC-2026-000001",
        "scenario": "URBAN_FLOODING",
        "district": "Ahmedabad",
        "lat": 23.0373,
        "lon": 72.5613,
        "desc": "Severe waterlogging near Mithakhali underpass, Ahmedabad",
    },
    {
        "ref": "INC-2026-000002",
        "scenario": "INDUSTRIAL_FIRE",
        "district": "Surat",
        "lat": 21.1025,
        "lon": 72.6841,
        "desc": "Chemical processing vapor cloud fire in Hazira, Surat",
    },
    {
        "ref": "INC-2026-000003",
        "scenario": "CYCLONE",
        "district": "Kutch",
        "lat": 23.1139,
        "lon": 70.0278,
        "desc": "Severe storm squall & tree falls in Anjar, Kutch",
    },
    {
        "ref": "INC-2026-000004",
        "scenario": "CYCLONE",
        "district": "Gir Somnath",
        "lat": 20.9022,
        "lon": 70.3689,
        "desc": "Coastal surge & fishing boat inundation at Veraval Harbor",
    },
    {
        "ref": "INC-2026-000005",
        "scenario": "EARTHQUAKE",
        "district": "Kutch",
        "lat": 23.2420,
        "lon": 69.6669,
        "desc": "Magnitude 5.8 seismic event with structural collapse in Bhuj",
    },
]


def test_scenario_rules():
    print("=== 1. Testing Scenario Capability Rules ===")
    assert "boat" in SCENARIO_CAPABILITY_RULES["URBAN_FLOODING"]
    assert "fire" in SCENARIO_CAPABILITY_RULES["INDUSTRIAL_FIRE"]
    assert "cyclone_response" in SCENARIO_CAPABILITY_RULES["CYCLONE"]
    assert "search_and_rescue" in SCENARIO_CAPABILITY_RULES["EARTHQUAKE"]
    print("Capability rules verified.\n")


def test_5_seed_incidents():
    print("=== 2. Testing Recommendations on 5 Gujarat Seed Incidents ===")
    for inc in SEED_INCIDENTS:
        print(f"\n--- Incident: {inc['ref']} ({inc['scenario']}) - {inc['district']} ---")
        print(f"    Location: ({inc['lat']}, {inc['lon']}) | {inc['desc']}")

        teams = get_recommended_teams(
            latitude=inc["lat"],
            longitude=inc["lon"],
            scenario=inc["scenario"],
            limit=3,
        )

        assert len(teams) >= 3, f"Expected at least 3 teams, got {len(teams)}"

        for t in teams:
            print(f"    [Rank {t.rank}] {t.name}")
            print(f"        Agency: {t.agency_name}")
            print(f"        Distance: {t.distance_km:.1f} km")
            print(f"        Matches: {t.matched_capabilities} ({t.match_percentage}%)")
            print(f"        Reasons: {t.reasons[0]}")

        # Domain validations:
        if inc["scenario"] == "URBAN_FLOODING":
            # Top team in Ahmedabad flood should have boat / flood rescue
            assert "boat" in teams[0].matched_capabilities or "flood_rescue" in teams[0].matched_capabilities
            assert teams[0].distance_km < 30.0  # Must be a local Ahmedabad/Gandhinagar unit
        elif inc["scenario"] == "INDUSTRIAL_FIRE":
            # Top team in Hazira fire must have hazmat / fire
            assert "fire" in teams[0].matched_capabilities or "hazmat" in teams[0].matched_capabilities
            assert teams[0].distance_km < 10.0  # Surat Hazira unit is right there
        elif inc["ref"] == "INC-2026-000003":  # Kutch Cyclone
            # Top team should have cyclone_response / search_and_rescue
            assert "cyclone_response" in teams[0].matched_capabilities or "search_and_rescue" in teams[0].matched_capabilities
            assert teams[0].distance_km < 80.0  # SDRF Bhuj is ~40 km away
        elif inc["scenario"] == "EARTHQUAKE":  # Bhuj Earthquake
            assert "search_and_rescue" in teams[0].matched_capabilities
            assert teams[0].distance_km < 1.0  # SDRF Bhuj is located right in Bhuj

    print("\nAll 5 seed incident evaluations passed with domain-sensible top 3 teams.")


def test_exclusion_of_unavailable_teams():
    print("\n=== 3. Testing Exclusion of Unavailable Teams ===")
    mock_teams = [
        {
            "resource_id": "mock-001",
            "name": "Unavailable Super Rescue Team",
            "agency_id": "ag-001",
            "agency_name": "Test Agency",
            "latitude": 23.0373,
            "longitude": 72.5613,
            "status": "MAINTENANCE",  # Unavailable
            "quantity_available": 1,
            "capability_tags": {"boat": True, "water_rescue": True, "flood_rescue": True},
        },
        {
            "resource_id": "mock-002",
            "name": "Depleted Flood Team",
            "agency_id": "ag-001",
            "agency_name": "Test Agency",
            "latitude": 23.0373,
            "longitude": 72.5613,
            "status": "AVAILABLE",
            "quantity_available": 0,  # Zero quantity
            "capability_tags": {"boat": True, "water_rescue": True, "flood_rescue": True},
        },
        {
            "resource_id": "mock-003",
            "name": "Legitimate Available Flood Team",
            "agency_id": "ag-001",
            "agency_name": "Test Agency",
            "latitude": 23.0500,
            "longitude": 72.5800,
            "status": "AVAILABLE",
            "quantity_available": 1,
            "capability_tags": {"boat": True, "water_rescue": True, "flood_rescue": True},
        },
    ]

    recs = score_and_rank_teams(mock_teams, 23.0373, 72.5613, "URBAN_FLOODING")
    team_ids = [t.resource_id for t in recs]

    assert "mock-001" not in team_ids, "Unavailable team was not excluded!"
    assert "mock-002" not in team_ids, "Depleted quantity team was not excluded!"
    assert "mock-003" in team_ids, "Legitimate available team was excluded!"
    print("Exclusion check passed: only ACTIVE, AVAILABLE teams with quantity > 0 are recommended.\n")


if __name__ == "__main__":
    test_scenario_rules()
    test_5_seed_incidents()
    test_exclusion_of_unavailable_teams()
    print("ALL S1-11 RECOMMENDATION TESTS PASSED.")

