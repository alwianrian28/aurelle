import { useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { mediaUrl } from '@/lib/api';
import { CATEGORY, useShop } from '@/lib/shop';
import { Button, color, idr } from '@/lib/ui';

const WIDTH = Dimensions.get('window').width;

/** Product: photo, variant, quantity, add to cart. Stock and price come from the API. */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { catalog, cart, setQty } = useShop();
  const router = useRouter();
  const product = catalog?.products.find((p) => p.id === id);
  const [variantId, setVariantId] = useState(product?.variants.find((v) => v.stock > 0)?.id ?? product?.variants[0]?.id ?? '');
  const [qty, setCount] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) return <View style={styles.center}><Text style={styles.muted}>Product not found.</Text></View>;
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const inCart = cart.find((l) => l.variantId === variant.id)?.qty ?? 0;
  const canAdd = Math.max(0, variant.stock - inCart);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Image source={{ uri: mediaUrl(product.thumb) }} style={styles.photo} resizeMode="cover" accessibilityLabel={product.name.en} />
      <View style={styles.body}>
        <Text style={styles.category}>{CATEGORY[product.category]}</Text>
        <Text style={styles.name}>{product.name.en}</Text>
        <Text style={styles.price}>{idr(variant.priceIdr)}</Text>
        <Text style={styles.text}>{product.description.en}</Text>
        <Text style={styles.muted}>Materials: {product.materials.en}</Text>

        {product.variants.length > 1 && (
          <View style={styles.block}>
            <Text style={styles.label}>Select a variant</Text>
            <View style={styles.options}>
              {product.variants.map((v) => (
                <Pressable key={v.id} accessibilityRole="button" accessibilityState={{ selected: v.id === variant.id, disabled: v.stock <= 0 }} disabled={v.stock <= 0}
                  onPress={() => { setVariantId(v.id); setCount(1); setAdded(false); }}
                  style={[styles.option, v.id === variant.id && styles.optionActive, v.stock <= 0 && { opacity: 0.4 }]}>
                  <Text style={[styles.optionText, v.id === variant.id && { color: color.white }]}>{v.label.en}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.block}>
          <Text style={styles.label}>Quantity</Text>
          <View style={styles.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" onPress={() => setCount((n) => Math.max(1, n - 1))} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
            <Text style={styles.count}>{qty}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" disabled={qty >= canAdd} onPress={() => setCount((n) => Math.min(canAdd, n + 1))} style={[styles.step, qty >= canAdd && { opacity: 0.35 }]}><Text style={styles.stepText}>+</Text></Pressable>
          </View>
          <Text style={styles.muted}>{variant.stock > 0 ? `In stock: ${variant.stock}` : 'Sold out'}</Text>
        </View>

        {canAdd > 0
          ? <Button title="Add to cart" onPress={() => { setQty(variant.id, inCart + Math.min(qty, canAdd)); setCount(1); setAdded(true); }} />
          : <Text style={styles.muted}>{variant.stock > 0 ? 'All available stock of this variant is already in your cart.' : 'This variant is currently sold out.'}</Text>}
        {added && <Button title="View cart" variant="outline" onPress={() => router.push('/cart')} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.white },
  photo: { width: WIDTH, height: WIDTH * 1.25, backgroundColor: '#f1f0ed' },
  body: { gap: 12, padding: 20 },
  category: { fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: color.soft },
  name: { fontSize: 26, fontWeight: '500', color: color.ink },
  price: { fontSize: 18, color: color.ink },
  text: { fontSize: 14, lineHeight: 22, color: color.muted },
  muted: { fontSize: 13, lineHeight: 19, color: color.soft },
  block: { gap: 10, marginTop: 6 },
  label: { fontSize: 13, fontWeight: '600', color: color.ink },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#c9cdd4' },
  optionActive: { borderColor: color.ink, backgroundColor: color.ink },
  optionText: { fontSize: 13, color: color.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#c9cdd4' },
  stepText: { fontSize: 20, color: color.ink },
  count: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '600', color: color.ink },
});
