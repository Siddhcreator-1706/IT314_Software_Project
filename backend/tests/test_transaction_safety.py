"""Best-effort database helpers must not poison the caller's transaction.

PostgreSQL aborts a transaction after any failed statement. A helper that catches the error and
carries on must run its statement inside a savepoint, or every later statement of the caller fails
with "current transaction is aborted" and the whole action is rolled back.
"""

import uuid

from app import common
from app.services import dispatch as dispatch_svc


def test_failed_progress_insert_leaves_the_transaction_usable(sql):
    from app import db

    with db.transaction() as conn:
        # No dispatch has this id, so the foreign key rejects the ledger row.
        progress_id = dispatch_svc.record_dispatch_progress(conn, uuid.uuid4(), "ON_SCENE", "arrived")

        assert progress_id is None
        assert conn.execute("SELECT 1 AS ok").fetchone()["ok"] == 1


def test_failed_email_lookup_leaves_the_transaction_usable(sql):
    from app import db

    with db.transaction() as conn:
        # Not a UUID, so the recipient lookup fails inside PostgreSQL.
        common._email_copy(conn, "not-a-uuid", "Title", "Body")

        assert conn.execute("SELECT 1 AS ok").fetchone()["ok"] == 1


def test_failed_email_lookup_does_not_discard_the_callers_write(sql):
    from app import db

    action = f"TXN_SAFETY_{uuid.uuid4().hex[:12]}"
    with db.transaction() as conn:
        conn.execute(
            "INSERT INTO audit_logs (action, entity_type, result) VALUES (%s, 'system', 'SUCCESS')",
            (action,),
        )
        common._email_copy(conn, "not-a-uuid", "Title", "Body")

    stored = sql.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action = %s", (action,)).fetchone()
    assert stored["n"] == 1
