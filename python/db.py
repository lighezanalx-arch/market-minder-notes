"""SQLite layer. Two physically separate databases, as requested:
  data/journal.db                 — starting balance, days, trades, withdrawals
  data/strategies/strategies.db   — strategies, notes, photos
"""
from __future__ import annotations
import os
import sqlite3
import json
from pathlib import Path
from contextlib import contextmanager
from typing import Iterator

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
JOURNAL_DB = Path(os.environ.get("JOURNAL_DB", DATA / "journal.db"))
STRATEGIES_DB = Path(
    os.environ.get("STRATEGIES_DB", DATA / "strategies" / "strategies.db")
)


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


@contextmanager
def journal() -> Iterator[sqlite3.Connection]:
    con = _connect(JOURNAL_DB)
    try:
        yield con
        con.commit()
    finally:
        con.close()


@contextmanager
def strategies() -> Iterator[sqlite3.Connection]:
    con = _connect(STRATEGIES_DB)
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init() -> None:
    with journal() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS days (
                date TEXT PRIMARY KEY,
                notes TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL REFERENCES days(date) ON DELETE CASCADE,
                time TEXT NOT NULL DEFAULT '',
                direction TEXT,
                outcome TEXT,
                pnl REAL,
                commissions REAL,
                notes TEXT NOT NULL DEFAULT '',
                created TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS day_photos (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL REFERENCES days(date) ON DELETE CASCADE,
                caption TEXT NOT NULL DEFAULT '',
                mime TEXT NOT NULL,
                data BLOB NOT NULL,
                created TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS withdrawals (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                amount REAL NOT NULL,
                commissions REAL NOT NULL DEFAULT 0,
                note TEXT NOT NULL DEFAULT ''
            );
            INSERT OR IGNORE INTO meta(key, value) VALUES ('starting_balance', '0');
            """
        )
    with strategies() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS strategies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                created TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS strategy_photos (
                id TEXT PRIMARY KEY,
                strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
                caption TEXT NOT NULL DEFAULT '',
                mime TEXT NOT NULL,
                data BLOB NOT NULL,
                created TEXT NOT NULL
            );
            """
        )


# ── helpers ──────────────────────────────────────────────────────────────
def get_starting_balance() -> float:
    with journal() as c:
        row = c.execute("SELECT value FROM meta WHERE key='starting_balance'").fetchone()
        return float(row["value"]) if row else 0.0


def set_starting_balance(v: float) -> None:
    with journal() as c:
        c.execute(
            "INSERT INTO meta(key,value) VALUES('starting_balance',?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (str(v),),
        )


def export_all() -> dict:
    out: dict = {"starting_balance": get_starting_balance(), "days": {}, "withdrawals": [], "strategies": []}
    with journal() as c:
        for d in c.execute("SELECT * FROM days").fetchall():
            out["days"][d["date"]] = {
                "notes": d["notes"],
                "trades": [dict(t) for t in c.execute("SELECT * FROM trades WHERE date=?", (d["date"],)).fetchall()],
                "photos": [
                    {**dict(p), "data": None}  # blobs omitted from JSON export
                    for p in c.execute("SELECT id,caption,mime,created FROM day_photos WHERE date=?", (d["date"],)).fetchall()
                ],
            }
        out["withdrawals"] = [dict(w) for w in c.execute("SELECT * FROM withdrawals").fetchall()]
    with strategies() as c:
        for s in c.execute("SELECT * FROM strategies").fetchall():
            out["strategies"].append({
                **dict(s),
                "photos": [
                    {**dict(p), "data": None}
                    for p in c.execute("SELECT id,caption,mime,created FROM strategy_photos WHERE strategy_id=?", (s["id"],)).fetchall()
                ],
            })
    return out


def export_json(path: Path) -> None:
    path.write_text(json.dumps(export_all(), indent=2))
