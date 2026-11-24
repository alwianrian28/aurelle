import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { mediaUrl } from '@/lib/api';
import { useShop } from '@/lib/shop';
import { Button, color, idr } from '@/lib/ui';

export default function Cart() {
  const { cart, find, setQty } = useShop();
  const router = useRouter();
  const lines = cart.map((line) => ({ line, found: find(line.variantId) }));
  const subtotal = lines.reduce((sum, l) => sum + (l.found ? l.found.variant.priceIdr * l.line.qty : 0), 0);
  // A line whose stock dropped below its quantity (or that left the catalog) blocks checkout.
  const blocked = lines.some((l) => !l.found || l.found.variant.stock < l.line.qty);

  if (cart.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Your cart is empty.</Text>
        <Button title="Browse the collection" onPress={() => router.replace('/')} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {lines.map(({ line, found }) => (
        <View key={line.variantId} style={styles.item}>
          {found && <Image source={{ uri: mediaUrl(found.product.thumb) }} style={styles.photo} />}
          <View style={styles.info}>
            <Text style={styles.name}>{found?.product.name.en ?? 'This piece is no longer available'}</Text>
            {found && <Text style={styles.muted}>{found.variant.label.en} · {idr(found.variant.priceIdr)}</Text>}
            {found && found.variant.stock < line.qty && <Text style={styles.warn}>Only {found.variant.stock} left. Please reduce the quantity.</Text>}
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" onPress={() => setQty(line.variantId, line.qty - 1)} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
              <Text style={styles.count}>{line.qty}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" disabled={!found || line.qty >= found.variant.stock} onPress={() => setQty(line.variantId, line.qty + 1)} style={[styles.step, (!found || line.qty >= found.variant.stock) && { opacity: 0.35 }]}><Text style={styles.stepText}>+</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setQty(line.variantId, 0)}><Text style={styles.remove}>Remove</Text></Pressable>
            </View>
          </View>
        </View>
      ))}
      <View style={styles.total}><Text style={styles.name}>Subtotal</Text><Text style={styles.name}>{idr(subtotal)}</Text></View>
      <Text style={styles.muted}>Shipping and duties are calculated at checkout.</Text>
      {blocked ? <Text style={styles.warn}>Please update your cart before continuing.</Text> : <Button title="Proceed to checkout" onPress={() => router.push('/checkout')} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', gap: 20, padding: 24, backgroundColor: color.white },
  item: { flexDirection: 'row', gap: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: color.line },
  photo: { width: 84, height: 105, borderRadius: 8, backgroundColor: '#f1f0ed' },
  info: { flex: 1, gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: color.ink },
  muted: { fontSize: 13, lineHeight: 19, color: color.soft, textAlign: 'left' },
  warn: { fontSize: 13, color: color.error },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#c9cdd4' },
  stepText: { fontSize: 18, color: color.ink },
  count: { minWidth: 20, textAlign: 'center', fontSize: 15, fontWeight: '600', color: color.ink },
  remove: { marginLeft: 6, fontSize: 13, color: color.error, textDecorationLine: 'underline' },
  total: { flexDirection: 'row', justifyContent: 'space-between' },
});
