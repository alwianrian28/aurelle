import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useShop } from '@/lib/shop';
import { authStyles as styles } from '@/lib/authStyles';
import { Button, Field } from '@/lib/ui';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { cart } = useShop();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href={cart.length > 0 ? '/checkout' : '/'} />;

  const submit = async () => {
    setBusy(true);
    setError(await login(email.trim(), password));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>AURELLE</Text>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.body}>Track your orders and deliveries.</Text>
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Button title="Sign in" onPress={submit} busy={busy} />
        <Text style={styles.switch}>New to Aurelle? <Link href="/register" style={styles.link}>Create an account</Link></Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
