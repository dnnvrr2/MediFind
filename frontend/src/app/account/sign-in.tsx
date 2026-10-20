import { useState } from 'react';
import { router } from 'expo-router';
import { useProfile } from '../../state/profile';
import { Page, Back, Card, Button, Text, TextLink, s, colors } from '../../components/ui';
import { CheckoutField } from '../../components/checkout-field';

export default function SignIn() {
  const { signIn } = useProfile();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  return <Page><Back title="Sign in" onBack={() => router.replace('/profile')} /><Card><Text style={s.heading}>Welcome back</Text><Text style={s.muted}>Sign in to your MediFind account. Your password is sent securely to the configured API and is never stored by this app.</Text><CheckoutField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} /><CheckoutField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} /><TextLink title="Forgot password?" onPress={() => router.push('/account/forgot-password')} />{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}<Button title="Sign in" onPress={async () => { setError(''); const result = await signIn(email, password); if (!result.ok) { setError(result.issue); return; } setPassword(''); router.replace('/profile'); }} /><TextLink title="Create an account" onPress={() => router.push('/account/register')} /></Card></Page>;
}
