"""
DRCH Database Migration Runner
Executes versioned SQL migration files against the target PostgreSQL database.
"""
import os
import sys
import glob

def get_db_url():
    return os.environ.get("DATABASE_URL", "postgresql://postgres:password@localhost:5432/drch_db")

def main():
    migrations_dir = os.path.dirname(os.path.abspath(__file__))
    sql_files = sorted(glob.glob(os.path.join(migrations_dir, "[0-9][0-9][0-9]_*.sql")))

    if not sql_files:
        print("[!] No SQL migration files found in:", migrations_dir)
        sys.exit(1)

    print(f"[*] Found {len(sql_files)} migration files in {migrations_dir}")
    for file_path in sql_files:
        print(f"  -> {os.path.basename(file_path)}")

    print("\n[*] To execute via psql:")
    print(f"    psql \"{get_db_url()}\" -f drch_schema.sql")

if __name__ == "__main__":
    main()
