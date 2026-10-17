import logging
import os
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("drch.db")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@postgres-postgis:5432/drch_db"
)

def get_connection():
    """Create a new PostgreSQL database connection."""
    return psycopg2.connect(DATABASE_URL)

@contextmanager
def get_db():
    """
    Context manager for transactional database operations.
    Commits on clean exit, rolls back on exception.
    """
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error(f"Database transaction rolled back due to error: {exc}")
        raise
    finally:
        conn.close()

def query_one(sql: str, params: tuple | None = None) -> dict | None:
    """Execute query and return a single row as a dictionary."""
    with get_db() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params or ())
        row = cur.fetchone()
        return dict(row) if row else None

def query_all(sql: str, params: tuple | None = None) -> list[dict]:
    """Execute query and return all matching rows as dictionaries."""
    with get_db() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params or ())
        rows = cur.fetchall()
        return [dict(r) for r in rows]

def execute_write(sql: str, params: tuple | None = None) -> int:
    """Execute an INSERT/UPDATE/DELETE statement and return rowcount."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.rowcount
