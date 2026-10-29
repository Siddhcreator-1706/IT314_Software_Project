"""Validate seed_data.sql: count teams and check all capability JSON blocks."""
import json
import pathlib
import re
import sys

sql = pathlib.Path("backend/db/seeds/seed_data.sql").read_text(encoding="utf-8")

# Count team names
teams = re.findall(r"'TEAM'::resource_type,\s*\n?\s*'([^']+)'", sql)
print(f"Total TEAM rows: {len(teams)}")
for i, t in enumerate(teams, 1):
    print(f"  {i:2}. {t}")

# Validate all ::jsonb blocks
tags_raw = re.findall(r"'\{[^']+\}'::jsonb", sql)
print(f"\nCapability tag blocks: {len(tags_raw)}")
ok = True
for i, raw in enumerate(tags_raw, 1):
    blob = raw[1 : raw.index("'::jsonb")]  # strip wrapping quotes and ::jsonb
    try:
        json.loads(blob)
    except json.JSONDecodeError as e:
        print(f"  JSON ERROR block {i}: {e}\n  -> {blob}")
        ok = False
if ok:
    print("  All JSON blocks valid")

# Show all capability keys
all_keys: set[str] = set()
for raw in tags_raw:
    blob = raw[1 : raw.index("'::jsonb")]
    try:
        all_keys |= json.loads(blob).keys()
    except Exception:
        pass
print(f"\nAll capability keys in seed: {sorted(all_keys)}")
sys.exit(0 if ok else 1)

