import { useEffect, useState } from 'react';
import { loadOrderTracking } from '../lib/shipping';
import type { OrderTracking } from '../types/domain';

/** The estimated position moves with time: the page asks again this often while it is open. */
const REFRESH_MS = 60_000;

/**
 * The courier's scans, the driver and the shipment map of one of the signed-in customer's own
 * orders. `null` until it has loaded, when it cannot be had, or while `orderId` is undefined
 * (no order picked, or no courier booked yet). `changed` is anything that says the shipment
 * moved (the order's `tracking.updatedAt`): a new value asks again at once.
 */
export function useCourierTracking(orderId: string | undefined, changed?: string | null): OrderTracking | null {
  const [loaded, setLoaded] = useState<{ orderId: string; tracking: OrderTracking | null } | null>(null);
  useEffect(() => {
    if (!orderId) return;
    let gone = false;
    const load = () => void loadOrderTracking(orderId).then((tracking) => { if (!gone && tracking) setLoaded({ orderId, tracking }); });
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { gone = true; window.clearInterval(timer); };
  }, [orderId, changed]);
  // An answer for another order is never shown for this one.
  return orderId && loaded?.orderId === orderId ? loaded.tracking : null;
}
