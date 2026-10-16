"""Persistence service using SQLite for analyst investigation records and notes."""
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Optional

from backend.config import DATA_SQLITE_PATH
from backend.models.schemas import SavedInvestigation, SavedInvestigationCreate


class InvestigationStore:
    def __init__(self, db_path: Path = DATA_SQLITE_PATH) -> None:
        self.db_path = Path(db_path)
        self.init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self) -> None:
        """Create sqlite tables if they do not exist."""
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS saved_investigations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tender_id TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT 'open',
                    priority TEXT NOT NULL DEFAULT 'medium',
                    analyst_notes TEXT NOT NULL DEFAULT '',
                    tags TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_inv_tender ON saved_investigations(tender_id)")
            conn.commit()

    def get_investigation(self, tender_id: str) -> Optional[SavedInvestigation]:
        """Fetch investigation record for a tender by tender ID."""
        with self._get_connection() as conn:
            cur = conn.execute(
                "SELECT * FROM saved_investigations WHERE tender_id = ?",
                (tender_id.strip(),),
            )
            row = cur.fetchone()
            if not row:
                return None
            return SavedInvestigation(
                id=row["id"],
                tender_id=row["tender_id"],
                status=row["status"],
                priority=row["priority"],
                analyst_notes=row["analyst_notes"],
                tags=row["tags"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    def list_investigations(self, status: Optional[str] = None) -> list[SavedInvestigation]:
        """List all saved investigations, optionally filtering by status."""
        query = "SELECT * FROM saved_investigations"
        params: list[str] = []
        if status:
            query += " WHERE status = ?"
            params.append(status.strip().lower())
        query += " ORDER BY updated_at DESC"

        with self._get_connection() as conn:
            cur = conn.execute(query, params)
            rows = cur.fetchall()
            return [
                SavedInvestigation(
                    id=r["id"],
                    tender_id=r["tender_id"],
                    status=r["status"],
                    priority=r["priority"],
                    analyst_notes=r["analyst_notes"],
                    tags=r["tags"],
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                )
                for r in rows
            ]

    def save_investigation(self, data: SavedInvestigationCreate) -> SavedInvestigation:
        """Create or update an investigation record for a tender."""
        now = datetime.now(timezone.utc).isoformat()
        tid = data.tender_id.strip()

        with self._get_connection() as conn:
            # Check if exists
            cur = conn.execute("SELECT id, created_at FROM saved_investigations WHERE tender_id = ?", (tid,))
            existing = cur.fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE saved_investigations
                    SET status = ?, priority = ?, analyst_notes = ?, tags = ?, updated_at = ?
                    WHERE tender_id = ?
                    """,
                    (data.status, data.priority, data.analyst_notes, data.tags or "", now, tid),
                )
                rec_id = existing["id"]
                created_at = existing["created_at"]
            else:
                cur2 = conn.execute(
                    """
                    INSERT INTO saved_investigations (tender_id, status, priority, analyst_notes, tags, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (tid, data.status, data.priority, data.analyst_notes, data.tags or "", now, now),
                )
                rec_id = cur2.lastrowid
                created_at = now
            conn.commit()

        return SavedInvestigation(
            id=rec_id,
            tender_id=tid,
            status=data.status,
            priority=data.priority,
            analyst_notes=data.analyst_notes,
            tags=data.tags or "",
            created_at=created_at,
            updated_at=now,
        )

    def delete_investigation(self, tender_id: str) -> bool:
        """Delete an investigation record."""
        with self._get_connection() as conn:
            cur = conn.execute(
                "DELETE FROM saved_investigations WHERE tender_id = ?",
                (tender_id.strip(),),
            )
            conn.commit()
            return cur.rowcount > 0
