import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useProfile } from '../../state/profile';
import { Page, Back, Card, Button, Text, TextLink, s, colors } from '../../components/ui';
import { safeReturnTo, signedInDestination } from '../../domain/public-access';
import { CheckoutField } from '../../components/checkout-field';

export default function SignIn() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination = safeReturnTo(returnTo);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const { signIn } = useProfile();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  return <Page><Back title="Sign in" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} /><Card><CheckoutField error={attempted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Enter a valid email address.' : undefined} label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} /><CheckoutField error={attempted && password.length < 8 ? "Use at least 8 characters." : undefined} label="Password" value={password} onChangeText={setPassword} secureTextEntry showPasswordToggle autoCapitalize="none" maxLength={128} /><TextLink title="Forgot password?" onPress={() => router.push({ pathname: '/account/forgot-password', params: { returnTo: destination } })} />{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}<Button title={busy ? "Signing in..." : "Sign in"} disabled={busy} onPress={async () => { if (busy) return; setAttempted(true); setBusy(true); setError(''); const result = await signIn(email, password); setBusy(false); if (!result.ok) { setError(result.issue); return; } setPassword(''); router.replace(signedInDestination(destination, result.isStaff, result.profile) as Parameters<typeof router.replace>[0]); }} /><TextLink title="Create an account" onPress={() => router.push({ pathname: '/account/register', params: { returnTo: destination } })} /></Card></Page>;
}
