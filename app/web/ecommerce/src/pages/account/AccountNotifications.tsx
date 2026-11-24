import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useMyOrders } from '../../hooks/useMyOrders';
import { useLocalePath, useLocalized } from '../../hooks/useLocale';
import type { OrderStatusEvent } from '../../types/domain';
import { useShortDate } from './parts';

/** Which message an order event becomes. */
function kindOf(event: OrderStatusEvent): string {
  if (event.status === 'cancelled') return event.paymentStatus === 'expired' ? 'expired' : 'cancelled';
  if (event.status === 'awaiting_payment') return event.paymentStatus === 'failed' ? 'failed' : event.paymentStatus === 'pending' ? 'pending' : 'placed';
  if (event.status === 'confirmed') return 'paid';
  if (event.status === 'pending_decision') return 'review';
  return event.status;
}

const readKey = (userId: string) => `aurelle_notifications_read_${userId}`;
function loadReadAt(userId: string): string {
  try { return localStorage.getItem(readKey(userId)) ?? ''; } catch { return ''; }
}

/**
 * F-17 In-app notifications, derived from the customer's own order history.
 * Transactional email and WhatsApp are not active yet (they need INT-02), so those
 * channels are shown as coming soon and cannot be switched on.
 */
export default function AccountNotifications() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const text = useLocalized();
  const date = useShortDate();
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  const orders = useMyOrders();
  // "Read" is remembered on this device: everything up to this moment counts as read.
  const [readAt, setReadAt] = useState(() => loadReadAt(userId));

  const items = orders
    .flatMap((o) =>
      o.history.map((h, i) => {
        const kind = kindOf(h);
        const vars = { number: o.number, courier: o.tracking?.courier || o.shippingService.courier, items: o.items.map((item) => text(item.name)).join(', ') };
        return { id: `${o.id}-${i}`, at: h.at, to: path(`/account/orders/${o.id}`), title: t(`acct.notif.${kind}.title`, vars), body: t(`acct.notif.${kind}.body`, vars) };
      }),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const hasUnread = items.some((n) => n.at > readAt);

  const markAllRead = () => {
    const now = new Date().toISOString();
    setReadAt(now);
    try { localStorage.setItem(readKey(userId), now); } catch { /* storage blocked: read state lasts for this visit */ }
  };

  const channels = [
    { id: 'page', title: t('acct.onPage'), body: t('acct.onPageBody'), on: true },
    { id: 'email', title: t('acct.email'), body: t('acct.emailBody'), on: false },
    { id: 'whatsapp', title: t('acct.whatsapp'), body: t('acct.whatsappBody'), on: false },
  ];

  return (
    <>
      <header className="acct-title">
        <div>
          <h2>{t('account.notifications')}</h2>
          <p>{t('acct.notifIntro')}</p>
        </div>
        {hasUnread && <button id="notifications-read" type="button" className="acct-textbtn" onClick={markAllRead}>{t('acct.markRead')}</button>}
      </header>

      {items.length === 0 ? (
        <div className="acct-card acct-empty"><p>{t('notifications.empty')}</p></div>
      ) : (
        <div className="acct-card">
          <ul className="acct-notifs">
            {items.map((n) => (
              <li key={n.id} className={n.at > readAt ? 'is-unread' : ''}>
                <NavLink to={n.to}>
                  <span>
                    <strong>{n.at > readAt && <span className="visually-hidden">{t('acct.unread')}: </span>}{n.title}</strong>
                    <span>{n.body}</span>
                  </span>
                  <time dateTime={n.at}>{date(n.at)}</time>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="acct-card" aria-labelledby="notifications-channels-title">
        <h3 id="notifications-channels-title" className="acct-label acct-label--ink">{t('acct.howNotify')}</h3>
        <ul className="acct-channels">
          {channels.map((c) => (
            <li key={c.id}>
              <div>
                <strong id={`channel-${c.id}`}>{c.title}</strong>
                <span>{c.body}{!c.on && <> <em>{t('acct.comingSoon')}</em></>}</span>
              </div>
              {/* Fixed for now: on-page updates cannot be turned off, the other channels are not built yet. */}
              <span className={`acct-switch${c.on ? ' is-on' : ''}`} role="switch" aria-checked={c.on} aria-disabled="true" aria-labelledby={`channel-${c.id}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
