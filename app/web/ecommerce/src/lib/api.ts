/**
 * Thin client for the Aurelle API (FastAPI). Same-origin `/api`, session in an httpOnly
 * cookie, JSON in and out. Never throws: callers branch on `ok`.
 */
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data?: Record<string, unknown> };

export async function api<T = Record<string, unknown>>(path: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'server_error', data };
  } catch {
    // Offline, or the API is not running.
    return { ok: false, status: 0, error: 'network' };
  }
}
