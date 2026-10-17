"""SQLite accounts and records. Every document query is scoped to its owner.

Nothing is stored in a browser's localStorage. The database lives in .data/,
which is excluded from Git. Use a persistent disk when deploying elsewhere.
"""

from contextlib import contextmanager
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from pathlib import Path

PASSWORD_ITERATIONS = 600_000
DOCUMENT_TYPES = {"profile", "journal", "run", "eeg", "goal", "draft"}


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PASSWORD_ITERATIONS
    ).hex()


class Database:
    def __init__(self, filename):
        self.filename = Path(filename)
        self.filename.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    salt TEXT NOT NULL,
                    password_hash TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS documents (
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    kind TEXT NOT NULL,
                    record_key TEXT NOT NULL,
                    data TEXT NOT NULL,
                    PRIMARY KEY(user_id, kind, record_key)
                );
                CREATE TABLE IF NOT EXISTS login_attempts (
                    email TEXT PRIMARY KEY,
                    failures INTEGER NOT NULL,
                    last_failure REAL NOT NULL
                );
            """
            )

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.filename, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def register(self, name, email, password):
        name = name.strip()
        email = email.strip().lower()
        if not name or len(name) > 80:
            raise ValueError("Enter a name between 1 and 80 characters.")
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(email) > 254:
            raise ValueError("Enter a valid email address.")
        if not 10 <= len(password) <= 256:
            raise ValueError("Use a password between 10 and 256 characters.")
        salt = secrets.token_hex(16)
        digest = password_hash(password, salt)
        try:
            with self.connect() as connection:
                cursor = connection.execute(
                    "INSERT INTO users(name,email,salt,password_hash) VALUES(?,?,?,?)",
                    (name, email, salt, digest),
                )
                return {"id": cursor.lastrowid, "name": name, "email": email}
        except sqlite3.IntegrityError:
            raise ValueError("An account with that email already exists.") from None

    def sign_in(self, email, password):
        email = email.strip().lower()
        if len(email) > 254 or len(password) > 256:
            raise ValueError("Email or password is incorrect.")
        with self.connect() as connection:
            attempt = connection.execute(
                "SELECT * FROM login_attempts WHERE email=?", (email,)
            ).fetchone()
            if (
                attempt
                and attempt["failures"] >= 5
                and time.time() - attempt["last_failure"] < 900
            ):
                raise ValueError("Too many failed attempts. Try again in 15 minutes.")
            user = connection.execute(
                "SELECT * FROM users WHERE email=?", (email,)
            ).fetchone()
        # A dummy hash makes unknown accounts take a similar amount of work.
        salt = user["salt"] if user else "00" * 16
        actual = password_hash(password, salt)
        if not user or not hmac.compare_digest(actual, user["password_hash"]):
            with self.connect() as connection:
                failures = (
                    attempt["failures"]
                    if attempt and time.time() - attempt["last_failure"] < 900
                    else 0
                ) + 1
                connection.execute(
                    "INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)",
                    (email, failures, time.time()),
                )
            raise ValueError("Email or password is incorrect.")
        with self.connect() as connection:
            connection.execute("DELETE FROM login_attempts WHERE email=?", (email,))
        return {"id": user["id"], "name": user["name"], "email": user["email"]}

    def _check_owner(self, user_id, kind):
        if not isinstance(user_id, int) or user_id < 1:
            raise ValueError("Sign in before accessing records.")
        if kind not in DOCUMENT_TYPES:
            raise ValueError("Unknown record type.")

    def save(self, user_id, kind, key, data):
        self._check_owner(user_id, kind)
        encoded = json.dumps(data, allow_nan=False)
        if len(encoded.encode()) > 3_000_000:
            raise ValueError("This record exceeds the 3 MB limit.")
        with self.connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO documents VALUES(?,?,?,?)",
                (user_id, kind, str(key), encoded),
            )

    def get(self, user_id, kind, key, default=None):
        self._check_owner(user_id, kind)
        with self.connect() as connection:
            row = connection.execute(
                "SELECT data FROM documents WHERE user_id=? AND kind=? AND record_key=?",
                (user_id, kind, str(key)),
            ).fetchone()
        return json.loads(row["data"]) if row else default

    def list(self, user_id, kind):
        self._check_owner(user_id, kind)
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT record_key,data FROM documents WHERE user_id=? AND kind=? ORDER BY record_key",
                (user_id, kind),
            ).fetchall()
        return [
            {"key": row["record_key"], "data": json.loads(row["data"])} for row in rows
        ]

    def delete(self, user_id, kind, key):
        self._check_owner(user_id, kind)
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM documents WHERE user_id=? AND kind=? AND record_key=?",
                (user_id, kind, str(key)),
            )

    def export(self, user_id):
        return {
            kind: self.list(user_id, kind)
            for kind in sorted(DOCUMENT_TYPES)
            if kind != "draft"
        }

    def delete_records(self, user_id):
        self._check_owner(user_id, "profile")
        with self.connect() as connection:
            connection.execute("DELETE FROM documents WHERE user_id=?", (user_id,))

    def import_documents(self, user_id, documents):
        """One transaction: malformed backups cannot leave a half-finished import."""
        prepared = []
        for kind, key, value in documents:
            self._check_owner(user_id, kind)
            encoded = json.dumps(value, allow_nan=False)
            if len(encoded.encode()) > 3_000_000:
                raise ValueError("An imported record exceeds 3 MB.")
            prepared.append((user_id, kind, str(key), encoded))
        with self.connect() as connection:
            connection.executemany(
                "INSERT OR REPLACE INTO documents VALUES(?,?,?,?)", prepared
            )
