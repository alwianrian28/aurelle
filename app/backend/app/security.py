import hashlib
import secrets
import threading
import time

import bcrypt


# bcrypt cost factor ("salt rounds"): 2**12 key-expansion rounds per hash.
BCRYPT_ROUNDS = 12
# bcrypt only reads the first 72 bytes of a password; longer ones are refused instead of
# being silently truncated.
MAX_PASSWORD_BYTES = 72


def password_too_long(password: str) -> bool:
    return len(password.encode()) > MAX_PASSWORD_BYTES


def hash_password(password: str) -> str:
    """bcrypt with a random 16-byte salt per password; the result embeds salt and cost ($2b$12$...)."""
    if password_too_long(password):
        raise ValueError("password longer than 72 bytes")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()


def verify_password(password: str, stored: str) -> bool:
    if password_too_long(password):
        return False
    try:
        return bcrypt.checkpw(password.encode(), stored.encode())
    except ValueError:  # not a bcrypt hash (e.g. an account created before the switch)
        return False


def new_token() -> str:
    """Random secret handed to the client; only its SHA-256 goes into the database."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class Limiter:
    """Failed-attempt limiter (FR-01-07): after `max_fails` failures a key is locked for `lock_s`.

    In-memory: enough for one process; move to shared storage when scaling out.
    """

    def __init__(self, max_fails: int, lock_s: float) -> None:
        self.max_fails, self.lock_s = max_fails, lock_s
        self._entries: dict[str, list[float]] = {}  # key -> [fails, locked_until]
        self._lock = threading.Lock()

    def locked_for(self, key: str) -> float:
        with self._lock:
            entry = self._entries.get(key)
            return max(0.0, entry[1] - time.time()) if entry else 0.0

    def fail(self, key: str) -> None:
        with self._lock:
            entry = self._entries.setdefault(key, [0, 0.0])
            entry[0] += 1
            if entry[0] >= self.max_fails:
                entry[0], entry[1] = 0, time.time() + self.lock_s

    def reset(self, key: str) -> None:
        with self._lock:
            self._entries.pop(key, None)
