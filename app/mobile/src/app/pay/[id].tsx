import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, type Order } from '@/lib/api';
import { Button, PAYMENT, Pill, color, idr, paymentTone } from '@/lib/ui';

/**
 * Payment step. No payment provider is connected yet, so this screen drives the API's
 * development-only gateway simulator: "pending" first, then the confirmed result, the way a
 * real gateway's redirect is followed by its verified webhook. Production builds talk to the
 * real gateway instead (the simulator endpoint does not exist there).
 */
export default function Pay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchOrder = useCallback(() => api<{ order: Order }>(`/orders/${encodeURIComponent(id)}`), [id]);
  const load = async () => {
    const res = await fetchOrder();
    if (res.ok) setOrder(res.data.order);
  };
  useEffect(() => {
    let live = true;
    void fetchOrder().then((res) => { if (live && res.ok) setOrder(res.data.order); });
    return () => { live = false; };
  }, [fetchOrder]);

  const report = async (paymentStatus: 'pending' | 'paid' | 'failed') => {
    const res = await api<{ order: Order }>(`/orders/${encodeURIComponent(id)}/demo-payment`, { body: { paymentStatus } });
    if (res.ok) setOrder(res.data.order);
    return res.ok;
  };

  const pay = async (outcome: 'paid' | 'failed') => {
    setBusy(true);
    setError('');
    const started = outcome === 'failed' || (await report('pending'));
    if (started && outcome === 'paid') await new Promise((resolve) => setTimeout(resolve, 1500)); // webhook delay
    if (!started || !(await report(outcome))) setError('We couldn\'t process your payment. Please refresh and try again.');
    setBusy(false);
    void load();
  };

  if (!order) return <View style={styles.center}><ActivityIndicator color={color.ink} /></View>;
  const awaiting = order.status === 'awaiting_payment';

  return (
    <View style={styles.screen}>
      <Text style={styles.muted}>Order</Text>
      <Text style={styles.number}>{order.number}</Text>
      <Text style={styles.total}>{idr(order.costs.total)}</Text>
      <Pill text={PAYMENT[order.paymentStatus] ?? order.paymentStatus} tone={paymentTone(order.paymentStatus)} />

      {awaiting ? (
        <View style={styles.block}>
          <Text style={styles.muted}>Please complete payment by {new Date(order.reservationExpiresAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Your pieces are reserved until then.</Text>
          <Text style={styles.note}>Payment simulation (development): no payment gateway is connected yet.</Text>
          <Button title="Simulate successful payment" onPress={() => void pay('paid')} busy={busy} />
          <Button title="Simulate failed payment" variant="outline" onPress={() => void pay('failed')} busy={busy} />
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.text}>{order.paymentStatus === 'paid' ? 'Payment received. Thank you! We are now preparing your order.' : 'This order is no longer awaiting payment.'}</Text>
          <Button title="View order" onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: order.id } })} />
        </View>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button title="Continue shopping" variant="outline" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 12, padding: 24, backgroundColor: color.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.white },
  number: { fontSize: 22, fontWeight: '600', color: color.ink },
  total: { fontSize: 28, color: color.ink },
  block: { gap: 12, marginVertical: 12 },
  text: { fontSize: 15, lineHeight: 22, color: color.ink },
  muted: { fontSize: 13, lineHeight: 19, color: color.soft },
  note: { padding: 12, borderRadius: 8, backgroundColor: '#fdf1d8', color: '#7a5200', fontSize: 13, lineHeight: 19 },
  error: { fontSize: 14, color: color.error },
});
