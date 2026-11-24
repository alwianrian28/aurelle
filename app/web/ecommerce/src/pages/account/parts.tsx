import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Order, ReadyStockOrderStatus } from '../../types/domain';
import { useLocale } from '../../hooks/useLocale';
import SmartImage from '../../components/SmartImage';

/** Shared pieces of the account pages: status badge, thumbnails, icons, dates. */

const BADGE: Record<ReadyStockOrderStatus, string> = {
  awaiting_payment: 'acct-badge--warn',
  pending_decision: 'acct-badge--warn',
  confirmed: 'acct-badge--ink',
  preparing: 'acct-badge--ink',
  ready_to_ship: 'acct-badge--ink',
  shipped: 'acct-badge--ink',
  delivered: '',
  cancelled: 'acct-badge--error',
};

export function OrderBadge({ status }: { status: ReadyStockOrderStatus }) {
  const { t } = useTranslation();
  return <span className={`acct-badge ${BADGE[status]}`}>{t(`order.status.${status}`)}</span>;
}

export const isOpenOrder = (order: Order) => order.status !== 'delivered' && order.status !== 'cancelled';

export function Thumb({ src, size = 48 }: { src?: string; size?: number }) {
  return (
    <span className="acct-thumb" style={{ width: size, height: size * 1.25 }}>
      <SmartImage src={src} alt="" category="ring" />
    </span>
  );
}

/** "12 Nov" by default, "12 Nov 2026" with the year. */
export function useShortDate() {
  const locale = useLocale();
  return (iso: string, year = false) =>
    new Date(iso).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
}

/** Text link with a trailing arrow, used at the edge of cards and headings. */
export function ArrowLink({ id, to, children }: { id: string; to: string; children: React.ReactNode }) {
  return (
    <NavLink id={id} to={to} className="acct-arrow">
      {children}<ArrowIcon />
    </NavLink>
  );
}

export function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function TruckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3v3.500h-7z" /><circle cx="7" cy="17.500" r="1.800" /><circle cx="17" cy="17.500" r="1.800" />
    </svg>
  );
}
