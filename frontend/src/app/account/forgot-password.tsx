import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { safeReturnTo } from '../../domain/public-access';
import { api, ApiError } from '../../api/client';
import { Page, Back, Card, Button, Text, s, colors } from '../../components/ui';
import { CheckoutField } from '../../components/checkout-field';

export default function ForgotPassword() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination = safeReturnTo(returnTo);
  const [email, setEmail] = useState(''); const [submitted, setSubmitted] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <Page><Back title="Reset password" onBack={() => router.replace({ pathname: '/account/sign-in', params: { returnTo: destination } })} /><Card>{submitted && <Text style={s.heading}>Check your email</Text>}<Text style={s.muted}>{submitted ? 'If an account matches that email, you’ll receive a link to reset its password.' : 'Enter your email to request a reset link.'}</Text>{!submitted && <><CheckoutField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} />{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}<Button title={busy ? 'Sending…' : 'Send reset link'} disabled={busy || !email.trim()} onPress={async () => { setBusy(true); setError(''); try { await api.requestPasswordReset(email.trim().toLowerCase()); setSubmitted(true); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not request a reset link. Try again.'); } finally { setBusy(false); } }} /></>}<Button title="Back to sign in" secondary onPress={() => router.replace({ pathname: '/account/sign-in', params: { returnTo: destination } })} /></Card></Page>;
}
