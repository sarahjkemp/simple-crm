#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import secrets
import sqlite3
import threading
from datetime import date
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("CRM_DATA_DIR", ROOT_DIR / "data"))
DB_PATH = Path(os.environ.get("CRM_DB_PATH", DATA_DIR / "crm.sqlite3"))
PORT = int(os.environ.get("PORT", "8000"))
SESSION_COOKIE = "simple_crm_session"
DEFAULT_PASSWORD = os.environ.get("CRM_PASSWORD", "change-me-now")

RELATIONSHIP_TYPES = [
    ("prospect", "Potential customer"),
    ("customer", "Current customer"),
    ("journalist", "Journalist"),
    ("referrer", "Referrer"),
    ("podcast-guest", "Podcast guest"),
    ("partner", "Partner / peer"),
]

RELATIONSHIP_STATUS = [
    ("new", "New"),
    ("warm", "Warm"),
    ("active", "Active"),
    ("dormant", "Dormant"),
]

SALES_STAGES = [
    ("watchlist", "Watching"),
    ("lead", "New lead"),
    ("discovery", "Discovery"),
    ("proposal", "Proposal sent"),
    ("negotiation", "Negotiation"),
    ("won", "Won"),
    ("lost", "Lost"),
]

PRIORITIES = [
    ("high", "High"),
    ("medium", "Medium"),
    ("low", "Low"),
]

SESSIONS: dict[str, dict[str, str]] = {}
SESSIONS_LOCK = threading.Lock()

SAMPLE_CONTACTS = [
    {
        "name": "Maya Chen",
        "company": "Northstar Studio",
        "email": "maya@northstarstudio.co",
        "phone": "+44 7700 900123",
        "source": "Referral",
        "relationshipType": "prospect",
        "relationshipStatus": "active",
        "isSales": True,
        "salesStage": "discovery",
        "value": 6500,
        "priority": "high",
        "lastContact": "2026-05-08",
        "nextFollowUp": "2026-05-13",
        "nextAction": "Send revised proposal with workshop scope",
        "notes": "Warm intro via Hannah. Wants a 6-week narrative sprint and homepage rewrite.",
    },
    {
        "name": "Leo Foster",
        "company": "Signal Peak",
        "email": "leo@signalpeak.ai",
        "phone": "+44 7700 900456",
        "source": "LinkedIn",
        "relationshipType": "prospect",
        "relationshipStatus": "warm",
        "isSales": True,
        "salesStage": "watchlist",
        "value": 4200,
        "priority": "high",
        "lastContact": "2026-05-06",
        "nextFollowUp": "2026-05-12",
        "nextAction": "Check whether board sign-off came through",
        "notes": "Interested in visibility audit. Needs board sign-off before moving to proposal.",
    },
    {
        "name": "Imani Rivers",
        "company": "Canvas Health",
        "email": "imani@canvashealth.com",
        "phone": "+1 415 555 0107",
        "source": "Website",
        "relationshipType": "prospect",
        "relationshipStatus": "new",
        "isSales": True,
        "salesStage": "watchlist",
        "value": 2400,
        "priority": "medium",
        "lastContact": "2026-05-04",
        "nextFollowUp": str(date.today()),
        "nextAction": "Reply with starter package and booking link",
        "notes": "Downloaded report and asked for pricing. Good fit for light advisory package.",
    },
    {
        "name": "Tom Alvarez",
        "company": "Fieldnote Labs",
        "email": "tom@fieldnotelabs.io",
        "phone": "+1 415 555 0148",
        "source": "Podcast",
        "relationshipType": "customer",
        "relationshipStatus": "active",
        "isSales": True,
        "salesStage": "won",
        "value": 9600,
        "priority": "high",
        "lastContact": "2026-05-09",
        "nextFollowUp": "2026-05-20",
        "nextAction": "Prep kickoff agenda",
        "notes": "Signed. Kickoff booked for next week. Retainer plus messaging workshop.",
    },
    {
        "name": "Sophie Malik",
        "company": "The Ledger",
        "email": "sophie@theledger.co.uk",
        "phone": "",
        "source": "Twitter",
        "relationshipType": "journalist",
        "relationshipStatus": "warm",
        "isSales": False,
        "salesStage": "",
        "value": 0,
        "priority": "medium",
        "lastContact": "2026-05-01",
        "nextFollowUp": "2026-05-14",
        "nextAction": "Send a clean angle on AI visibility for founders",
        "notes": "Covers B2B software and founder stories. Likes short, useful emails.",
    },
    {
        "name": "Rachel Dunn",
        "company": "Intro Circle",
        "email": "rachel@introcircle.com",
        "phone": "",
        "source": "Mutual friend",
        "relationshipType": "referrer",
        "relationshipStatus": "active",
        "isSales": False,
        "salesStage": "",
        "value": 0,
        "priority": "high",
        "lastContact": "2026-05-03",
        "nextFollowUp": "2026-05-10",
        "nextAction": "Thank her for last intro and share who is a good fit",
        "notes": "Consistently introduces founders. Worth staying warm with light updates.",
    },
    {
        "name": "Nate Brooks",
        "company": "Creator Frequency",
        "email": "nate@creatorfrequency.fm",
        "phone": "",
        "source": "Podcast outreach",
        "relationshipType": "podcast-guest",
        "relationshipStatus": "warm",
        "isSales": False,
        "salesStage": "",
        "value": 0,
        "priority": "medium",
        "lastContact": "2026-05-02",
        "nextFollowUp": "2026-05-15",
        "nextAction": "Confirm talking points and recording date",
        "notes": "Potential guest swap and referral source later, but not a sales conversation.",
    },
]


def db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                company TEXT DEFAULT '',
                email TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                source TEXT DEFAULT '',
                relationship_type TEXT NOT NULL,
                relationship_status TEXT NOT NULL,
                is_sales INTEGER NOT NULL DEFAULT 0,
                sales_stage TEXT DEFAULT '',
                value INTEGER NOT NULL DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'medium',
                last_contact TEXT DEFAULT '',
                next_follow_up TEXT DEFAULT '',
                next_action TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        count = conn.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
        if count == 0:
            for contact in SAMPLE_CONTACTS:
                insert_contact(conn, normalize_contact(contact), contact_id=secrets.token_hex(12))
        conn.commit()


def normalize_contact(payload: dict) -> dict:
    return {
        "name": str(payload.get("name", "")).strip(),
        "company": str(payload.get("company", "")).strip(),
        "email": str(payload.get("email", "")).strip(),
        "phone": str(payload.get("phone", "")).strip(),
        "source": str(payload.get("source", "")).strip(),
        "relationshipType": str(payload.get("relationshipType", "partner")).strip() or "partner",
        "relationshipStatus": str(payload.get("relationshipStatus", "warm")).strip() or "warm",
        "isSales": bool(payload.get("isSales", False)),
        "salesStage": str(payload.get("salesStage", "")).strip(),
        "value": int(payload.get("value") or 0),
        "priority": str(payload.get("priority", "medium")).strip() or "medium",
        "lastContact": str(payload.get("lastContact", "")).strip(),
        "nextFollowUp": str(payload.get("nextFollowUp", "")).strip(),
        "nextAction": str(payload.get("nextAction", "")).strip(),
        "notes": str(payload.get("notes", "")).strip(),
    }


def insert_contact(conn: sqlite3.Connection, contact: dict, contact_id: str | None = None) -> dict:
    saved_id = contact_id or secrets.token_hex(12)
    conn.execute(
        """
        INSERT INTO contacts (
            id, name, company, email, phone, source, relationship_type,
            relationship_status, is_sales, sales_stage, value, priority,
            last_contact, next_follow_up, next_action, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            saved_id,
            contact["name"],
            contact["company"],
            contact["email"],
            contact["phone"],
            contact["source"],
            contact["relationshipType"],
            contact["relationshipStatus"],
            int(contact["isSales"]),
            contact["salesStage"],
            contact["value"],
            contact["priority"],
            contact["lastContact"],
            contact["nextFollowUp"],
            contact["nextAction"],
            contact["notes"],
        ),
    )
    return get_contact(conn, saved_id)


def get_contact(conn: sqlite3.Connection, contact_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()
    return row_to_contact(row) if row else None


def row_to_contact(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "company": row["company"],
        "email": row["email"],
        "phone": row["phone"],
        "source": row["source"],
        "relationshipType": row["relationship_type"],
        "relationshipStatus": row["relationship_status"],
        "isSales": bool(row["is_sales"]),
        "salesStage": row["sales_stage"],
        "value": row["value"],
        "priority": row["priority"],
        "lastContact": row["last_contact"],
        "nextFollowUp": row["next_follow_up"],
        "nextAction": row["next_action"],
        "notes": row["notes"],
    }


def list_contacts() -> list[dict]:
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM contacts
            ORDER BY
                CASE
                    WHEN next_follow_up = '' THEN 1
                    ELSE 0
                END,
                next_follow_up,
                name
            """
        ).fetchall()
    return [row_to_contact(row) for row in rows]


def create_contact(payload: dict) -> dict:
    contact = normalize_contact(payload)
    with db_connection() as conn:
        saved = insert_contact(conn, contact)
        conn.commit()
    return saved


def update_contact(contact_id: str, payload: dict) -> dict | None:
    contact = normalize_contact(payload)
    with db_connection() as conn:
        existing = get_contact(conn, contact_id)
        if not existing:
            return None
        conn.execute(
            """
            UPDATE contacts
            SET
                name = ?, company = ?, email = ?, phone = ?, source = ?,
                relationship_type = ?, relationship_status = ?, is_sales = ?,
                sales_stage = ?, value = ?, priority = ?, last_contact = ?,
                next_follow_up = ?, next_action = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                contact["name"],
                contact["company"],
                contact["email"],
                contact["phone"],
                contact["source"],
                contact["relationshipType"],
                contact["relationshipStatus"],
                int(contact["isSales"]),
                contact["salesStage"],
                contact["value"],
                contact["priority"],
                contact["lastContact"],
                contact["nextFollowUp"],
                contact["nextAction"],
                contact["notes"],
                contact_id,
            ),
        )
        conn.commit()
        return get_contact(conn, contact_id)


def delete_contact(contact_id: str) -> bool:
    with db_connection() as conn:
        result = conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        conn.commit()
        return result.rowcount > 0


def reset_sample_data() -> list[dict]:
    with db_connection() as conn:
        conn.execute("DELETE FROM contacts")
        for contact in SAMPLE_CONTACTS:
            insert_contact(conn, normalize_contact(contact), contact_id=secrets.token_hex(12))
        conn.commit()
    return list_contacts()


class CRMRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/api/"):
            self.handle_api_get()
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.startswith("/api/"):
            self.handle_api_post()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PUT(self) -> None:
        if self.path.startswith("/api/"):
            self.handle_api_put()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self) -> None:
        if self.path.startswith("/api/"):
            self.handle_api_delete()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def end_headers(self) -> None:
        self._send_cors_headers()
        super().end_headers()

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

    def log_message(self, format: str, *args) -> None:
        super().log_message(format, *args)

    def _parse_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length) if length else b"{}"
        if not raw_body:
            return {}
        return json.loads(raw_body.decode("utf-8"))

    def _json(self, status: int, payload: dict, extra_headers: list[tuple[str, str]] | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for key, value in extra_headers:
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _session_token(self) -> str | None:
        cookie_header = self.headers.get("Cookie")
        if not cookie_header:
            return None
        cookie = SimpleCookie()
        cookie.load(cookie_header)
        morsel = cookie.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def _is_authenticated(self) -> bool:
        token = self._session_token()
        if not token:
            return False
        with SESSIONS_LOCK:
            return token in SESSIONS

    def _require_auth(self) -> bool:
        if self._is_authenticated():
            return True
        self._json(HTTPStatus.UNAUTHORIZED, {"error": "Authentication required"})
        return False

    def _create_session(self) -> str:
        token = secrets.token_urlsafe(32)
        with SESSIONS_LOCK:
            SESSIONS[token] = {"created": str(date.today())}
        return token

    def _destroy_session(self) -> None:
        token = self._session_token()
        if not token:
            return
        with SESSIONS_LOCK:
            SESSIONS.pop(token, None)

    def _session_cookie_header(self, token: str) -> str:
        secure = "; Secure" if os.environ.get("RENDER") else ""
        return f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax{secure}"

    def _expired_cookie_header(self) -> str:
        return f"{SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax"

    def handle_api_get(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/session":
            self._json(HTTPStatus.OK, {"authenticated": self._is_authenticated()})
            return

        if parsed.path == "/api/bootstrap":
            if not self._require_auth():
                return
            self._json(
                HTTPStatus.OK,
                {
                    "contacts": list_contacts(),
                    "options": {
                        "relationshipTypes": [{"value": value, "label": label} for value, label in RELATIONSHIP_TYPES],
                        "relationshipStatus": [{"value": value, "label": label} for value, label in RELATIONSHIP_STATUS],
                        "salesStages": [{"value": value, "label": label} for value, label in SALES_STAGES],
                        "priorities": [{"value": value, "label": label} for value, label in PRIORITIES],
                    },
                },
            )
            return

        if parsed.path == "/api/contacts":
            if not self._require_auth():
                return
            self._json(HTTPStatus.OK, {"contacts": list_contacts()})
            return

        self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def handle_api_post(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/session":
            payload = self._parse_json_body()
            password = str(payload.get("password", ""))
            if not secrets.compare_digest(password, DEFAULT_PASSWORD):
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "Incorrect password"})
                return
            token = self._create_session()
            self._json(
                HTTPStatus.OK,
                {"authenticated": True},
                extra_headers=[("Set-Cookie", self._session_cookie_header(token))],
            )
            return

        if not self._require_auth():
            return

        if parsed.path == "/api/session/logout":
            self._destroy_session()
            self._json(
                HTTPStatus.OK,
                {"authenticated": False},
                extra_headers=[("Set-Cookie", self._expired_cookie_header())],
            )
            return

        if parsed.path == "/api/contacts":
            payload = self._parse_json_body()
            created = create_contact(payload)
            self._json(HTTPStatus.CREATED, {"contact": created})
            return

        if parsed.path == "/api/reset-sample":
            contacts = reset_sample_data()
            self._json(HTTPStatus.OK, {"contacts": contacts})
            return

        self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def handle_api_put(self) -> None:
        if not self._require_auth():
            return
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/contacts/"):
            contact_id = parsed.path.rsplit("/", 1)[-1]
            payload = self._parse_json_body()
            updated = update_contact(contact_id, payload)
            if not updated:
                self._json(HTTPStatus.NOT_FOUND, {"error": "Contact not found"})
                return
            self._json(HTTPStatus.OK, {"contact": updated})
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def handle_api_delete(self) -> None:
        if not self._require_auth():
            return
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/contacts/"):
            contact_id = parsed.path.rsplit("/", 1)[-1]
            deleted = delete_contact(contact_id)
            if not deleted:
                self._json(HTTPStatus.NOT_FOUND, {"error": "Contact not found"})
                return
            self._json(HTTPStatus.OK, {"deleted": True})
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})


def main() -> None:
    initialize_database()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), CRMRequestHandler)
    print(f"Simple CRM running on http://0.0.0.0:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
