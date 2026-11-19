import { useState } from 'react';
import { router } from 'expo-router';
import { useProfile, profileFieldIssues } from '../../state/profile';
import { Page, Back, Card, Button, Text, TextLink, s, colors } from '../../components/ui';
import { CheckoutField } from '../../components/checkout-field';

export default function EditProfile() {
  const { profile, update } = useProfile();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!profile) return <Page><Back title="Edit profile" /><Card><Text style={s.text}>Sign in to edit your profile.</Text><Button title="Sign in" onPress={() => router.replace('/account/sign-in')} /></Card></Page>;

  const { firstNameIssue, lastNameIssue, phoneIssue } = profileFieldIssues({ firstName, lastName, phone });

  async function submit() {
    if (busy) return;
    setAttempted(true);
    setError('');
    if (firstNameIssue || lastNameIssue || phoneIssue) return;

    setBusy(true);
    const result = await update({ firstName, lastName, phone });
    setBusy(false);
    if (!result.ok) {
      setError(result.issue);
      return;
    }
    router.replace('/profile');
  }

  return <Page>
    <Back title="Edit profile" onBack={() => router.replace('/profile')} />
    <Card>
      <CheckoutField label="First name" required value={firstName} onChangeText={setFirstName} error={attempted ? firstNameIssue : undefined} autoCapitalize="words" autoComplete="given-name" maxLength={120} />
      <CheckoutField label="Last name" required value={lastName} onChangeText={setLastName} error={attempted ? lastNameIssue : undefined} autoCapitalize="words" autoComplete="family-name" maxLength={120} />
      <CheckoutField label="Email address" value={profile.email} editable={false} />
      <CheckoutField label="Mobile number" required value={phone} onChangeText={setPhone} error={attempted ? phoneIssue : undefined} keyboardType="phone-pad" maxLength={24} />
      <Text style={s.caption}>Email changes are not available yet.</Text>
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
      <Button title={busy ? 'Saving changes...' : 'Save changes'} disabled={busy} onPress={submit} />
      <TextLink title="Cancel" onPress={() => router.replace('/profile')} />
    </Card>
  </Page>;
}
