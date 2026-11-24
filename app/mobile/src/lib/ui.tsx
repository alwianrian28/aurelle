import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export const color = { ink: '#151922', muted: '#555f6d', soft: '#777d85', line: '#e7e7e3', paper: '#f8f8f6', white: '#ffffff', error: '#9b3b2f' };

export const STATUS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment', confirmed: 'Confirmed', preparing: 'Preparing', ready_to_ship: 'Ready to ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', pending_decision: 'Action needed',
};
export const PAYMENT: Record<string, string> = {
  unpaid: 'Unpaid', pending: 'Awaiting confirmation', paid: 'Paid', failed: 'Failed', expired: 'Expired',
  partial: 'Partially paid', review_finance: 'Under review', refund_pending: 'Refund in progress', refunded: 'Refunded',
};
export const idr = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
export const when = (iso: string) => new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={color.soft} style={styles.input} {...input} />
    </View>
  );
}

export function Button({ title, onPress, busy, variant = 'solid' }: { title: string; onPress: () => void; busy?: boolean; variant?: 'solid' | 'outline' }) {
  const solid = variant === 'solid';
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy: !!busy, disabled: !!busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.button, !solid && styles.buttonOutline, (pressed || busy) && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator color={solid ? color.white : color.ink} /> : <Text style={[styles.buttonText, !solid && { color: color.ink }]}>{title}</Text>}
    </Pressable>
  );
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const tones = { neutral: ['#eef0f3', color.ink], good: ['#e3f1e4', '#23602b'], warn: ['#fdf1d8', '#7a5200'], bad: ['#f8e3e0', '#8c2f25'] } as const;
  return <Text style={[styles.pill, { backgroundColor: tones[tone][0], color: tones[tone][1] }]}>{text}</Text>;
}

export const statusTone = (s: string) => (s === 'delivered' ? 'good' : s === 'cancelled' ? 'bad' : s === 'awaiting_payment' ? 'warn' : 'neutral');
export const paymentTone = (s: string) => (s === 'paid' ? 'good' : s === 'failed' || s === 'expired' ? 'bad' : 'warn');

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: color.ink },
  input: { height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: '#c9cdd4', borderRadius: 8, fontSize: 16, color: color.ink, backgroundColor: color.white },
  button: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: color.ink, backgroundColor: color.ink, paddingHorizontal: 24 },
  buttonOutline: { backgroundColor: color.white },
  buttonText: { color: color.white, fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  pill: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 12 },
});
