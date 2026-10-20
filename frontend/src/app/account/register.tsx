import { useState } from 'react';
import { router } from 'expo-router';
import { useProfile } from '../../state/profile';
import { Page, Back, Card, Button, Text, TextLink, s, colors } from '../../components/ui';
import { CheckoutField } from '../../components/checkout-field';

export default function Register() {
  const { register } = useProfile();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState('');
  return <Page><Back title="Create account" onBack={() => router.replace('/profile')} /><Card><Text style={s.heading}>Create your account</Text><Text style={s.muted}>Your account and profile will be saved to the MediFind API.</Text><CheckoutField label="Full name *" value={fullName} onChangeText={setFullName} autoCapitalize="words" maxLength={100} /><CheckoutField label="Email address *" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} /><CheckoutField label="Mobile number" value={phone} onChangeText={setPhone} placeholder="Optional · 09XXXXXXXXX" keyboardType="phone-pad" maxLength={24} /><CheckoutField label="Password *" value={password} onChangeText={setPassword} secureTextEntry maxLength={128} /><CheckoutField label="Confirm password *" value={confirm} onChangeText={setConfirm} secureTextEntry maxLength={128} />{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}<Button title="Create account" onPress={async () => { if (password !== confirm) { setError('The passwords do not match.'); return; } setError(''); const result = await register({ fullName, email, phone }, password); if (!result.ok) { setError(result.issue); return; } setPassword(''); setConfirm(''); router.replace('/profile'); }} /><TextLink title="Already have an account? Sign in" onPress={() => router.push('/account/sign-in')} /></Card></Page>;
}
