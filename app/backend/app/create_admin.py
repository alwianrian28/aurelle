"""Create an admin account, or promote an existing one.

    python -m app.create_admin <email> <password>
"""
import re
import sys
import uuid

from .auth import now_iso
from .db import connect, init_db
from .security import hash_password


def main() -> None:
    if len(sys.argv) != 3 or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", sys.argv[1]) or not 12 <= len(sys.argv[2].encode()) <= 72:
        sys.exit("Usage: python -m app.create_admin <email> <password (12-72 characters)>")
    email, password = sys.argv[1].lower(), sys.argv[2]
    init_db()
    db = connect()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        db.execute("UPDATE users SET role = 'admin', password_hash = ?, email_verified = 1 WHERE id = ?", (hash_password(password), existing["id"]))
        db.execute("DELETE FROM sessions WHERE user_id = ?", (existing["id"],))
        print(f"Updated {email}: now an admin with the new password.")
    else:
        db.execute(
            "INSERT INTO users (id, email, username, password_hash, role, email_verified, created_at) VALUES (?, ?, 'Admin', ?, 'admin', 1, ?)",
            (str(uuid.uuid4()), email, hash_password(password), now_iso()),
        )
        print(f"Created admin {email}.")
    db.commit()
    db.close()


if __name__ == "__main__":
    main()
