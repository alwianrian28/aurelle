import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from '@/lib/auth';
import { ShopProvider, useShop } from '@/lib/shop';
import { color } from '@/lib/ui';

function ShopHeaderRight() {
  const { cart } = useShop();
  const count = cart.reduce((n, l) => n + l.qty, 0);
  return (
    <View style={styles.right}>
      <Link href="/orders" style={styles.link}>Orders</Link>
      <Link href="/cart" style={styles.link} accessibilityLabel={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>Cart{count > 0 ? ` (${count})` : ''}</Link>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ShopProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTintColor: color.ink, headerTitleStyle: { fontWeight: '600' }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: color.white } }}>
          <Stack.Screen name="index" options={{ headerTitle: () => <Text style={styles.logo}>AURELLE</Text>, headerRight: () => <ShopHeaderRight /> }} />
          <Stack.Screen name="product/[id]" options={{ title: '', headerRight: () => <ShopHeaderRight /> }} />
          <Stack.Screen name="cart" options={{ title: 'Cart' }} />
          <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
          <Stack.Screen name="pay/[id]" options={{ title: 'Payment', headerBackVisible: false }} />
          <Stack.Screen name="orders/index" options={{ title: 'My orders' }} />
          <Stack.Screen name="orders/[id]" options={{ title: 'Order details' }} />
          <Stack.Screen name="login" options={{ title: 'Sign in', headerShown: false }} />
          <Stack.Screen name="register" options={{ title: 'Create account', headerShown: false }} />
        </Stack>
      </ShopProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  logo: { fontSize: 20, letterSpacing: 6, color: color.ink, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  right: { flexDirection: 'row', gap: 16 },
  link: { fontSize: 14, fontWeight: '500', color: color.ink },
});
