import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useShop } from '@/lib/shop';
import { Button, Field } from '@/lib/ui';
import { authStyles as styles } from '@/lib/authStyles';

export default function Register() {
  const { user, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { cart } = useShop();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href={cart.length > 0 ? '/checkout' : '/'} />;

  const submit = async () => {
    if (name.trim().length < 3) return setError('Please enter your name (at least 3 characters).');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError(await register(name.trim(), email.trim(), password));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>AURELLE</Text>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>JOIN AURELLE</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.body}>It only takes a minute.</Text>
        </View>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" textContentType="name" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Button title="Create account" onPress={submit} busy={busy} />
        <Text style={styles.switch}>Already have an account? <Link href="/login" style={styles.link}>Sign in</Link></Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
