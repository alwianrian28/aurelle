import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { api, type Costs, type Order } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useShop, type AddressForm } from '@/lib/shop';
import { Button, Field, color, idr } from '@/lib/ui';

const ERRORS: Record<string, string> = {
  network: 'We can\'t reach the server. Please check your connection.',
  price_changed: 'Some prices have changed. Please review your cart and confirm again.',
  out_of_stock: 'Some pieces are low in stock. Please update your cart.',
  country_not_served: 'We don\'t ship to this country yet.',
  email_unverified: 'Your email isn\'t verified yet. Please verify it before checking out.',
  invalid_input: 'Please complete your address (phone number must be 6–20 digits).',
};

/**
 * Checkout: address, shipping, payment method, then the order is created by the API, which
 * re-checks price and stock and computes the total. Nothing is priced on the device.
 */
export default function Checkout() {
  const { user } = useAuth();
  const { catalog, cart, find, address, saveAddress, clearCart, reload } = useShop();
  const router = useRouter();
  const [form, setForm] = useState<AddressForm>(address);
  const [serviceId, setServiceId] = useState(catalog?.shippingServices[0]?.id ?? '');
  const [method, setMethod] = useState<'qris' | 'card'>('qris');
  const [agreed, setAgreed] = useState(false);
  const [costs, setCosts] = useState<Costs | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState('');
  // One id per checkout attempt: a retry after a dropped connection cannot create a second order.
  const [orderId] = useState(() => `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

  const cartKey = cart.map((l) => `${l.variantId}:${l.qty}`).join(',');
  useEffect(() => {
    if (!serviceId || cart.length === 0) return;
    let live = true;
    void api<{ costs: Costs }>('/catalog/quote', { body: { items: cart, shippingServiceId: serviceId } }).then((res) => { if (live) setCosts(res.ok ? res.data.costs : null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cartKey stands for the cart's contents
  }, [cartKey, serviceId]);

  if (user === null) return <Redirect href="/login" />;
  if (!catalog || cart.length === 0) return <Redirect href="/cart" />;

  const set = (key: keyof AddressForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const complete = form.recipient.trim().length >= 2 && /^\+\d{1,4}$/.test(form.phoneCountryCode.trim()) && /^[\d\s-]{6,20}$/.test(form.phone.trim()) && form.state.trim() && form.city.trim() && form.line1.trim().length >= 3;

  const submit = async () => {
    setError('');
    setBusy(true);
    saveAddress(form);
    const res = await api<{ order: Order }>('/orders', {
      body: {
        id: orderId,
        items: cart.map((l) => ({ variantId: l.variantId, qty: l.qty, expectedPriceIdr: find(l.variantId)?.variant.priceIdr ?? 0 })),
        address: { ...form, recipient: form.recipient.trim(), phoneCountryCode: form.phoneCountryCode.trim(), phone: form.phone.trim(), state: form.state.trim(), city: form.city.trim(), line1: form.line1.trim() },
        shippingServiceId: serviceId, paymentMethod: method, currency: 'IDR',
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(ERRORS[res.error] ?? 'We couldn\'t place your order. Please try again.');
      if (res.error === 'price_changed' || res.error === 'out_of_stock') void reload();
      return;
    }
    clearCart();
    void reload();
    router.replace({ pathname: '/pay/[id]', params: { id: res.data.order.id } });
  };

  // Development aid: without an email provider the API returns the verification token.
  const resendVerification = async () => {
    const res = await api<{ devToken?: string }>('/auth/verify/resend', { method: 'POST' });
    setDevToken(res.ok ? res.data.devToken ?? '' : '');
    setError(res.ok ? 'A verification link has been sent to your email.' : 'Please wait a moment before resending.');
  };
  const verifyNow = async () => {
    const res = await api<{ result: string }>('/auth/verify', { body: { token: devToken } });
    if (res.ok && res.data.result === 'ok') { setDevToken(''); setError('Email verified. You may now place your order.'); }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>SHIPPING ADDRESS</Text>
        <Field label="Recipient name" value={form.recipient} onChangeText={set('recipient')} autoComplete="name" />
        <View style={styles.pair}>
          <View style={{ width: 96 }}><Field label="Code" value={form.phoneCountryCode} onChangeText={set('phoneCountryCode')} keyboardType="phone-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Phone number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" /></View>
        </View>
        <Text style={styles.label}>Country</Text>
        <View style={styles.options}>
          {catalog.servedCountries.map((country) => (
            <Choice key={country} label={country} selected={form.country === country} onPress={() => set('country')(country)} />
          ))}
        </View>
        <Field label="State / province" value={form.state} onChangeText={set('state')} />
        <View style={styles.pair}>
          <View style={{ flex: 1 }}><Field label="City" value={form.city} onChangeText={set('city')} /></View>
          <View style={{ width: 130 }}><Field label="Postal code" value={form.postalCode} onChangeText={set('postalCode')} keyboardType="number-pad" autoComplete="postal-code" /></View>
        </View>
        <Field label="Street address" value={form.line1} onChangeText={set('line1')} autoComplete="street-address" />

        <Text style={styles.heading}>SHIPPING</Text>
        {catalog.shippingServices.map((s) => (
          <Choice key={s.id} wide label={`${s.courier} — ${s.name.en}`} detail={`${s.etaDays} days · ${idr(s.costIdr)}`} selected={serviceId === s.id} onPress={() => setServiceId(s.id)} />
        ))}

        <Text style={styles.heading}>PAYMENT METHOD</Text>
        <View style={styles.options}>
          <Choice label="QRIS" selected={method === 'qris'} onPress={() => setMethod('qris')} />
          <Choice label="Visa/Mastercard" selected={method === 'card'} onPress={() => setMethod('card')} />
        </View>

        <Text style={styles.heading}>SUMMARY</Text>
        {costs ? (
          <View style={styles.summary}>
            <Row label="Subtotal" value={idr(costs.subtotal)} />
            <Row label="Shipping" value={idr(costs.shipping)} />
            <Row label="Estimated import duty" value={idr(costs.duty)} />
            {costs.tax + costs.other > 0 && <Row label="Taxes & other" value={idr(costs.tax + costs.other)} />}
            <Row label="Total" value={idr(costs.total)} strong />
          </View>
        ) : <Text style={styles.muted}>Calculating costs…</Text>}

        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed((v) => !v)} style={styles.agree}>
          <View style={[styles.box, agreed && styles.boxOn]}>{agreed && <Text style={styles.tick}>✓</Text>}</View>
          <Text style={styles.agreeText}>I agree to the Aurelle terms & conditions and payment policy.</Text>
        </Pressable>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {user && !user.emailVerified && (
          <View style={styles.verify}>
            <Text style={styles.muted}>Your email must be verified before checkout.</Text>
            <Pressable accessibilityRole="button" onPress={() => void resendVerification()}><Text style={styles.link}>Resend verification link</Text></Pressable>
            {devToken ? <Pressable accessibilityRole="button" onPress={() => void verifyNow()}><Text style={styles.link}>Verify now (development)</Text></Pressable> : null}
          </View>
        )}
        {complete && agreed && costs
          ? <Button title="Place order" onPress={() => void submit()} busy={busy} />
          : <Text style={styles.muted}>Complete your address and accept the terms to continue.</Text>}
        <Link href="/cart" style={styles.link}>Back to cart</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Choice({ label, detail, selected, onPress, wide }: { label: string; detail?: string; selected: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, wide && styles.choiceWide, selected && styles.choiceOn]}>
      <Text style={[styles.choiceText, selected && { color: color.white }]}>{label}</Text>
      {detail ? <Text style={[styles.muted, selected && { color: '#d7dae0' }]}>{detail}</Text> : null}
    </Pressable>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.row}><Text style={strong ? styles.strong : styles.text}>{label}</Text><Text style={strong ? styles.strong : styles.text}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  heading: { marginTop: 10, fontSize: 12, fontWeight: '600', letterSpacing: 1.6, color: color.muted },
  label: { fontSize: 14, fontWeight: '500', color: color.ink },
  pair: { flexDirection: 'row', gap: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#c9cdd4' },
  choiceWide: { borderRadius: 10, gap: 2 },
  choiceOn: { borderColor: color.ink, backgroundColor: color.ink },
  choiceText: { fontSize: 14, color: color.ink },
  summary: { gap: 8, padding: 16, borderRadius: 10, backgroundColor: color.paper },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  text: { fontSize: 14, color: color.ink },
  strong: { fontSize: 15, fontWeight: '700', color: color.ink },
  muted: { fontSize: 13, lineHeight: 19, color: color.soft },
  agree: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 6 },
  box: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: color.ink },
  boxOn: { backgroundColor: color.ink },
  tick: { color: color.white, fontSize: 14, lineHeight: 16 },
  agreeText: { flex: 1, fontSize: 13, lineHeight: 19, color: color.muted },
  error: { fontSize: 14, lineHeight: 20, color: color.error },
  verify: { gap: 8, padding: 14, borderRadius: 10, backgroundColor: '#fdf1d8' },
  link: { fontSize: 14, fontWeight: '600', color: color.ink, textDecorationLine: 'underline' },
});
