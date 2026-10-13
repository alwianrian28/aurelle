/**
 * Token sekali pakai untuk DEMO (verifikasi email & reset password).
 * Hanya menyimpan token acak, email tujuan, kedaluwarsa, dan status pakai — tidak pernah password.
 * Di produksi token dibuat, di-hash, dan divalidasi oleh backend (FR-01-06).
 */
export type TokenKind = 'verify' | 'reset';
export type TokenResult = 'ok' | 'invalid' | 'expired' | 'used';

interface Ticket {
  token: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

const key = (kind: TokenKind) => `aurelle_demo_${kind}_token`;

function read(kind: TokenKind): Ticket | null {
  const raw = sessionStorage.getItem(key(kind));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (
      typeof v.token !== 'string' ||
      typeof v.email !== 'string' ||
      typeof v.expiresAt !== 'number' ||
      typeof v.used !== 'boolean'
    )
      return null;
    return { token: v.token, email: v.email, expiresAt: v.expiresAt, used: v.used };
  } catch {
    return null; // storage rusak diperlakukan sebagai token tidak valid
  }
}

/** Menerbitkan token baru; token lama otomatis tidak berlaku. */
export function issueToken(kind: TokenKind, email: string, ttlMin: number): string {
  const token = crypto.randomUUID();
  const ticket: Ticket = { token, email: email.trim().toLowerCase(), expiresAt: Date.now() + ttlMin * 60000, used: false };
  sessionStorage.setItem(key(kind), JSON.stringify(ticket));
  return token;
}

/** Memeriksa token tanpa memakainya. */
export function inspectToken(kind: TokenKind, token: string | null): { result: TokenResult; email?: string } {
  const ticket = read(kind);
  if (!token || !ticket || ticket.token !== token) return { result: 'invalid' };
  if (ticket.used) return { result: 'used', email: ticket.email };
  if (ticket.expiresAt <= Date.now()) return { result: 'expired', email: ticket.email };
  return { result: 'ok', email: ticket.email };
}

/** Memakai token (sekali pakai, AC-01-05). */
export function consumeToken(kind: TokenKind, token: string | null): { result: TokenResult; email?: string } {
  const check = inspectToken(kind, token);
  if (check.result !== 'ok') return check;
  const ticket = read(kind);
  if (ticket) sessionStorage.setItem(key(kind), JSON.stringify({ ...ticket, used: true }));
  return check;
}
