import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, type Order } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import TrackingMap from '@/lib/TrackingMap';
import { PAYMENT, Pill, STATUS, color, idr, paymentTone, statusTone, when } from '@/lib/ui';

/** One order: status, shipment tracking on a map, items and totals. */
export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ order: Order }>(`/orders/${encodeURIComponent(id)}`);
    if (res.ok) setOrder(res.data.order);
    else if (res.status === 404) setMissing(true);
  }, [id]);

  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]));

  if (user === null) return <Redirect href="/login" />;
  if (missing) return <View style={styles.center}><Text style={styles.muted}>Order not found.</Text></View>;
  if (!order) return <View style={styles.center}><ActivityIndicator color={color.ink} /></View>;

  const { tracking } = order;
  const extra = order.costs.tax + order.costs.duty + order.costs.other;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={styles.card}>
        <Text style={styles.number}>{order.number}</Text>
        <Text style={styles.muted}>{when(order.createdAt)}</Text>
        <View style={styles.pills}>
          <Pill text={STATUS[order.status] ?? order.status} tone={statusTone(order.status)} />
          <Pill text={PAYMENT[order.paymentStatus] ?? order.paymentStatus} tone={paymentTone(order.paymentStatus)} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>TRACK SHIPMENT</Text>
        {tracking.trackingNumber ? <Text style={styles.text}>{tracking.courier} · Tracking no. <Text style={styles.strong}>{tracking.trackingNumber}</Text></Text> : null}
        {tracking.points.length > 0 ? (
          <>
            <TrackingMap points={tracking.points} />
            {[...tracking.points].reverse().map((p) => (
              <View key={p.id} style={styles.point}>
                <Text style={styles.strong}>{p.label}</Text>
                {p.note ? <Text style={styles.text}>{p.note}</Text> : null}
                <Text style={styles.muted}>{when(p.at)}</Text>
              </View>
            ))}
          </>
        ) : <Text style={styles.muted}>No tracking updates yet. They will appear here once your parcel is on its way.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>ITEMS</Text>
        {order.items.map((i) => (
          <View key={i.variantId} style={styles.line}>
            <Text style={[styles.text, { flex: 1 }]}>{i.qty} × {i.name.en}{i.variantLabel?.en ? ` (${i.variantLabel.en})` : ''}</Text>
            <Text style={styles.text}>{idr(i.qty * i.unitPriceIdr)}</Text>
          </View>
        ))}
        <View style={styles.line}><Text style={styles.text}>Shipping</Text><Text style={styles.text}>{idr(order.costs.shipping)}</Text></View>
        {extra > 0 && <View style={styles.line}><Text style={styles.text}>Taxes, duties & other</Text><Text style={styles.text}>{idr(extra)}</Text></View>}
        <View style={[styles.line, styles.totalLine]}><Text style={styles.strong}>Total</Text><Text style={styles.strong}>{idr(order.costs.total)}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>HISTORY</Text>
        {[...order.history].reverse().map((h, i) => (
          <View key={i} style={styles.point}>
            <Text style={styles.text}>{STATUS[h.status] ?? h.status} · {PAYMENT[h.paymentStatus] ?? h.paymentStatus}</Text>
            <Text style={styles.muted}>{when(h.at)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.white },
  card: { gap: 10, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: color.line, backgroundColor: color.white },
  number: { fontSize: 20, fontWeight: '600', color: color.ink },
  heading: { fontSize: 12, fontWeight: '600', letterSpacing: 1.6, color: color.muted },
  text: { fontSize: 14, lineHeight: 20, color: color.ink },
  strong: { fontSize: 14, fontWeight: '600', color: color.ink },
  muted: { fontSize: 13, lineHeight: 19, color: color.soft },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  point: { gap: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: color.line },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  totalLine: { paddingTop: 10, borderTopWidth: 1, borderTopColor: color.line },
});
