import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useRequestStore } from '../../store/requestStore';
import { useMyOrders } from '../../hooks/useMyOrders';
import { useLocale, useLocalePath } from '../../hooks/useLocale';

/**
 * F-17 Notifikasi in-app — diturunkan dari riwayat status pesanan & pengajuan milik pelanggan.
 * Pengiriman email/WhatsApp transaksional belum aktif (butuh backend + INT-02).
 */
export default function AccountNotifications() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const user = useAuthStore((s) => s.user);
  const orders = useMyOrders();
  const allRequests = useRequestStore((s) => s.requests);

  const items = [
    ...orders.flatMap((o) =>
      o.history.map((h, i) => ({
        id: `${o.id}-${i}`,
        at: h.at,
        to: `/account/orders/${o.id}`,
        text: t('notifications.order', {
          number: o.number,
          status: t(`order.status.${h.status}`),
          payment: t(`order.payStatus.${h.paymentStatus}`),
        }),
      })),
    ),
    ...allRequests
      .filter((r) => r.userId === user?.id)
      .flatMap((r) =>
        r.history.map((h, i) => ({
          id: `${r.id}-${i}`,
          at: h.at,
          to: '/account/requests',
          text: t('notifications.request', { number: r.number, status: t(`request.status.${h.status}`) }),
        })),
      ),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="card account-panel">
      <div className="account-panel__head">
        <h2>{t('account.notifications')}</h2>
      </div>
      <p className="field-hint">{t('notifications.demoNote')}</p>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>{t('notifications.empty')}</p>
        </div>
      ) : (
        <ul className="timeline" style={{ marginTop: 'var(--space-5)' }}>
          {items.map((n) => (
            <li key={n.id} className="timeline__item">
              <NavLink to={path(n.to)}>{n.text}</NavLink>
              <span className="text-muted">{fmt(n.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
