import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { api, type Order } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, PAYMENT, Pill, STATUS, color, idr, paymentTone, statusTone, when } from '@/lib/ui';

/** The signed-in customer's orders, newest first, with live status from the API. */
export default function Orders() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ orders: Order[] }>('/orders');
    setOffline(!res.ok);
    if (res.ok) setOrders(res.data.orders);
  }, []);

  // Reload whenever the screen comes back into view, then every 30 s while it is open.
  useFocusEffect(useCallback(() => {
    if (!user) return;
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [user, load]));

  if (user === undefined) return <View style={styles.center}><ActivityIndicator color={color.ink} /></View>;
  if (user === null) return <Redirect href="/login" />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={orders ?? []}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.hello}>Hello, {user.username}</Text>
          {!user.emailVerified && <Text style={styles.notice}>Your email is not verified yet. Please open the verification link we sent before checking out.</Text>}
          {offline && <Text accessibilityRole="alert" style={styles.notice}>Unable to reach the server. Pull down to try again.</Text>}
        </View>
      }
      ListEmptyComponent={orders === null && !offline ? <ActivityIndicator color={color.ink} style={{ marginTop: 40 }} /> : <Text style={styles.empty}>No orders yet. Orders placed in the app or on the Aurelle website will appear here.</Text>}
      ListFooterComponent={<View style={{ marginTop: 24 }}><Button title="Sign out" variant="outline" onPress={() => void logout()} /></View>}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Order ${item.number}`} onPress={() => router.push({ pathname: item.status === 'awaiting_payment' ? '/pay/[id]' : '/orders/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
          <View style={styles.row}><Text style={styles.number}>{item.number}</Text><Text style={styles.total}>{idr(item.costs.total)}</Text></View>
          <Text style={styles.date}>{when(item.createdAt)} · Qty {item.items.reduce((n, i) => n + i.qty, 0)}</Text>
          <View style={styles.pills}>
            <Pill text={STATUS[item.status] ?? item.status} tone={statusTone(item.status)} />
            <Pill text={PAYMENT[item.paymentStatus] ?? item.paymentStatus} tone={paymentTone(item.paymentStatus)} />
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.white },
  list: { padding: 16, gap: 12 },
  header: { gap: 10, marginBottom: 4 },
  hello: { fontSize: 22, fontWeight: '600', color: color.ink },
  notice: { padding: 12, borderRadius: 8, backgroundColor: '#fdf1d8', color: '#7a5200', fontSize: 13, lineHeight: 19 },
  empty: { marginTop: 40, textAlign: 'center', color: color.muted, fontSize: 14, lineHeight: 21 },
  card: { gap: 8, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: color.line, backgroundColor: color.white },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  number: { fontSize: 15, fontWeight: '600', color: color.ink },
  total: { fontSize: 15, color: color.ink },
  date: { fontSize: 13, color: color.soft },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
