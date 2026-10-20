import { useState } from 'react';
import { router } from 'expo-router';
import { useProfile } from '../../state/profile';
import { Page, Back, Card, Button, Text, TextLink, s, colors } from '../../components/ui';
import { CheckoutField } from '../../components/checkout-field';

export default function EditProfile() {
  const { profile, update } = useProfile();
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState('');
  if (!profile) return <Page><Back title="Edit profile" /><Card><Text style={s.text}>Sign in to a demo session before editing your profile.</Text><Button title="Sign in" onPress={() => router.replace('/account/sign-in')} /></Card></Page>;
  return <Page><Back title="Edit profile" onBack={() => router.replace('/profile')} /><Text style={s.muted}>Update the details saved to your account.</Text><Card><CheckoutField label="Full name *" value={fullName} onChangeText={setFullName} autoCapitalize="words" maxLength={100} /><CheckoutField label="Email address" value={email} editable={false} autoCapitalize="none" autoCorrect={false} maxLength={254} /><CheckoutField label="Mobile number" placeholder="09XXXXXXXXX or +639XXXXXXXXX" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={24} /><Text style={s.caption}>Email address changes require account verification and are not available here.</Text>{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}<Button title="Save changes" onPress={async () => { setError(''); const result = await update({ fullName, email, phone }); if (!result.ok) { setError(result.issue); return; } router.replace('/profile'); }} /><TextLink title="Cancel" onPress={() => router.replace('/profile')} /></Card></Page>;
}
