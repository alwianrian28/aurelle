import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { mediaUrl, type Category, type Product } from '@/lib/api';
import { CATEGORY, useShop } from '@/lib/shop';
import { color, idr } from '@/lib/ui';

const TABS: ('' | Category)[] = ['', 'necklace', 'earring', 'ring', 'bracelet'];

/** Shop: the catalog from the API, filterable by category. */
export default function Shop() {
  const { catalog, offline, reload } = useShop();
  const router = useRouter();
  const [category, setCategory] = useState<'' | Category>('');
  const [refreshing, setRefreshing] = useState(false);

  if (!catalog) {
    return (
      <View style={styles.center}>
        {offline ? <Text style={styles.muted}>Unable to reach the server.{'\n'}Check your connection and try again.</Text> : <ActivityIndicator color={color.ink} />}
        {offline && <Pressable accessibilityRole="button" onPress={() => void reload()}><Text style={styles.retry}>Try again</Text></Pressable>}
      </View>
    );
  }

  const products = catalog.products.filter((p) => !category || p.category === category);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      numColumns={2}
      data={products}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((tab) => (
            <Pressable key={tab} accessibilityRole="button" accessibilityState={{ selected: category === tab }} onPress={() => setCategory(tab)} style={[styles.tab, category === tab && styles.tabActive]}>
              <Text style={[styles.tabText, category === tab && styles.tabTextActive]}>{tab ? CATEGORY[tab] : 'All'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      }
      renderItem={({ item }) => <Card product={item} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })} />}
    />
  );
}

function Card({ product, onPress }: { product: Product; onPress: () => void }) {
  const price = Math.min(...product.variants.map((v) => v.priceIdr));
  const soldOut = product.variants.every((v) => v.stock <= 0);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${product.name.en}, ${idr(price)}${soldOut ? ', sold out' : ''}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <Image source={{ uri: mediaUrl(product.thumb) }} style={styles.photo} resizeMode="cover" />
      {soldOut && <Text style={styles.soldOut}>Sold out</Text>}
      <Text style={styles.category}>{CATEGORY[product.category]}</Text>
      <Text style={styles.name} numberOfLines={1}>{product.name.en}</Text>
      <Text style={styles.price}>{idr(price)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: color.white },
  muted: { textAlign: 'center', fontSize: 14, lineHeight: 21, color: color.muted },
  retry: { fontSize: 14, fontWeight: '600', color: color.ink, textDecorationLine: 'underline' },
  list: { padding: 16, gap: 20 },
  row: { gap: 12 },
  tabs: { gap: 8, paddingBottom: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#d7d8d4' },
  tabActive: { borderColor: color.ink, backgroundColor: color.ink },
  tabText: { fontSize: 13, color: color.muted },
  tabTextActive: { color: color.white },
  card: { flex: 1, gap: 4 },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: 10, backgroundColor: '#f1f0ed' },
  soldOut: { position: 'absolute', top: 10, left: 10, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: color.white, fontSize: 12, color: color.ink },
  category: { marginTop: 6, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: color.soft },
  name: { fontSize: 14, fontWeight: '500', color: color.ink },
  price: { fontSize: 13, color: color.muted },
});
