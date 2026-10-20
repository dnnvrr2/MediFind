import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../api/client';
import { Page, Back, Card, Button, Text, s, colors } from '../../components/ui';
import { CheckoutField } from '../../components/checkout-field';

export default function ResetPassword() {
  const params = useLocalSearchParams<{ uid?: string; token?: string }>();
  const uid = typeof params.uid === 'string' ? params.uid : '';
  const token = typeof params.token === 'string' ? params.token : '';
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <Page><Back title="Choose a new password" onBack={() => router.replace('/account/sign-in')} /><Card><Text style={s.heading}>{done ? 'Password updated' : 'Reset your password'}</Text><Text style={s.muted}>{done ? 'You can now sign in with your new password.' : 'Choose a new password for your account.'}</Text>{!done && <>{!uid || !token ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>This reset link is incomplete. Request a new one.</Text> : <><CheckoutField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} /><CheckoutField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" maxLength={128} /></>}{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}{!!uid && !!token && <Button title={busy ? 'Updating…' : 'Update password'} disabled={busy || password.length < 8 || password !== confirm} onPress={async () => { setBusy(true); setError(''); try { await api.confirmPasswordReset(uid, token, password); setDone(true); setPassword(''); setConfirm(''); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not reset your password. Request a new link and try again.'); } finally { setBusy(false); } }} />}</>}<Button title="Back to sign in" secondary onPress={() => router.replace('/account/sign-in')} /></Card></Page>;
}
