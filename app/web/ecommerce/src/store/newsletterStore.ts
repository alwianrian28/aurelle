import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale, NewsletterSubscriber } from '../types/domain';
import { NEWSLETTER_CONSENT_VERSION } from '../config/brand';

/**
 * Newsletter (mock) — F-06.
 * - FR-06-02: double opt-in adalah default kerja [U] (OD-30 masih terbuka) → status awal `pending_confirmation`.
 * - AC-06-02: email yang sama disimpan sebagai satu entri.
 * - FR-06-03: unsubscribe mengubah status menjadi `unsubscribed`.
 */
export type SubscribeResult = 'pending_confirmation' | 'already';

interface NewsletterState {
  subscribers: NewsletterSubscriber[];
  subscribe: (email: string, locale: Locale, source: NewsletterSubscriber['source']) => SubscribeResult;
  /** Simulasi klik tautan konfirmasi di email (belum ada layanan email nyata). */
  confirm: (email: string) => void;
  unsubscribe: (email: string) => void;
  statusOf: (email: string) => NewsletterSubscriber['status'] | null;
}

const norm = (email: string) => email.trim().toLowerCase();

export const useNewsletterStore = create<NewsletterState>()(
  persist(
    (set, get) => ({
      subscribers: [],
      subscribe: (email, locale, source) => {
        const key = norm(email);
        const existing = get().subscribers.find((s) => s.email === key);
        if (existing && existing.status !== 'unsubscribed') return 'already';
        const entry: NewsletterSubscriber = {
          email: key,
          status: 'pending_confirmation',
          locale,
          source,
          consentAt: new Date().toISOString(),
          consentVersion: NEWSLETTER_CONSENT_VERSION,
        };
        set((s) => ({
          subscribers: existing
            ? s.subscribers.map((x) => (x.email === key ? entry : x))
            : [...s.subscribers, entry],
        }));
        return 'pending_confirmation';
      },
      confirm: (email) =>
        set((s) => ({
          subscribers: s.subscribers.map((x) => (x.email === norm(email) ? { ...x, status: 'active' } : x)),
        })),
      unsubscribe: (email) =>
        set((s) => ({
          subscribers: s.subscribers.map((x) => (x.email === norm(email) ? { ...x, status: 'unsubscribed' } : x)),
        })),
      statusOf: (email) => get().subscribers.find((x) => x.email === norm(email))?.status ?? null,
    }),
    { name: 'aurelle_newsletter' },
  ),
);
