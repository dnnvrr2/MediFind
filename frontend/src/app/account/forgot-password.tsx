import { useState } from 'react';
import { router } from 'expo-router';
import { api, ApiError } from '../../api/client';
import { Page, Back, Card, Button, Text, s, colors } from '../../components/ui';
import { CheckoutField } from '../../components/checkout-field';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [submitted, setSubmitted] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <Page><Back title="Reset password" onBack={() => router.replace('/account/sign-in')} /><Card><Text style={s.heading}>{submitted ? 'Check your email' : 'Forgot your password?'}</Text><Text style={s.muted}>{submitted ? 'If an account matches that email, you’ll receive a link to reset its password.' : 'Enter your account email and we’ll send a password reset link if an account exists.'}</Text>{!submitted && <><CheckoutField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} />{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}<Button title={busy ? 'Sending…' : 'Send reset link'} disabled={busy || !email.trim()} onPress={async () => { setBusy(true); setError(''); try { await api.requestPasswordReset(email.trim().toLowerCase()); setSubmitted(true); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not request a reset link. Try again.'); } finally { setBusy(false); } }} /></>}<Button title="Back to sign in" secondary onPress={() => router.replace('/account/sign-in')} /></Card></Page>;
}
