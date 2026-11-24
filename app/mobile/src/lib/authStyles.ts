import { Platform, StyleSheet } from 'react-native';
import { color } from './ui';

/** Shared by the login and register screens. */
export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  content: { flexGrow: 1, justifyContent: 'center', gap: 18, padding: 24 },
  logo: { fontSize: 26, letterSpacing: 8, color: color.ink, textAlign: 'center', marginBottom: 12, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  head: { gap: 8, marginBottom: 4 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 2.4, color: color.muted },
  title: { fontSize: 38, color: color.ink, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  body: { fontSize: 15, lineHeight: 22, color: color.muted },
  error: { fontSize: 14, color: color.error },
  switch: { fontSize: 14, textAlign: 'center', color: color.muted },
  link: { fontWeight: '600', color: color.ink, textDecorationLine: 'underline' },
});
