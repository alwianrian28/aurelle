import { useOrderStore } from '../store/orderStore';
import { useAuthStore } from '../store/authStore';

/**
 * Pesanan milik pengguna aktif saja (FR-18-01).
 * Pada backend nyata, filter kepemilikan ditegakkan di server; ini hanya cermin di klien.
 */
export function useMyOrders() {
  const userId = useAuthStore((s) => s.user?.id);
  const orders = useOrderStore((s) => s.orders);
  return userId ? orders.filter((o) => o.userId === userId) : [];
}
