import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useProfile, profileFieldIssues, validEmail } from '../../state/profile';
import { Page, Back, Card, Button, Text, TextLink, s, colors } from '../../components/ui';
import { safeReturnTo, signedInDestination } from '../../domain/public-access';
import { CheckoutField } from '../../components/checkout-field';

export default function Register() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination = safeReturnTo(returnTo);
  const { register } = useProfile();
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const { firstNameIssue, lastNameIssue, phoneIssue } = profileFieldIssues({ firstName, lastName, phone });
  const emailIssue = validEmail(email) ? undefined : 'Enter a valid email address.';
  const passwordIssue = password.length < 8 ? 'Use at least 8 characters.' : undefined;
  const confirmIssue = !confirm ? 'Confirm your password.' : password !== confirm ? 'The passwords do not match.' : undefined;

  async function submit() {
    if (busy) return;
    setAttempted(true);
    setError('');
    if (firstNameIssue || lastNameIssue || emailIssue || phoneIssue || passwordIssue || confirmIssue) return;

    setBusy(true);
    const result = await register({ firstName, lastName, email, phone }, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.issue);
      return;
    }
    setPassword('');
    setConfirm('');
    router.replace(signedInDestination(destination, result.isStaff, result.profile) as Parameters<typeof router.replace>[0]);
  }

  return <Page>
    <Back title="Create account" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <Card>
      <CheckoutField label="First name" required error={attempted ? firstNameIssue : undefined} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" maxLength={120} />
      <CheckoutField label="Last name" required error={attempted ? lastNameIssue : undefined} value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" maxLength={120} />
      <CheckoutField label="Email address" required error={attempted ? emailIssue : undefined} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} />
      <CheckoutField label="Mobile number" required error={attempted ? phoneIssue : undefined} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={24} />
      <CheckoutField label="Password" required error={attempted ? passwordIssue : undefined} value={password} onChangeText={setPassword} secureTextEntry showPasswordToggle maxLength={128} />
      {!attempted && <Text style={s.caption}>Use at least 8 characters.</Text>}
      <CheckoutField label="Confirm password" required error={attempted ? confirmIssue : undefined} value={confirm} onChangeText={setConfirm} secureTextEntry showPasswordToggle maxLength={128} />
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
      <Button title={busy ? 'Creating account...' : 'Create account'} disabled={busy} onPress={submit} />
      <TextLink title="Privacy information" onPress={() => router.push('/privacy')} />
      <TextLink title="Terms information" onPress={() => router.push('/terms')} />
      <TextLink title="Already have an account? Sign in" onPress={() => router.push({ pathname: '/account/sign-in', params: { returnTo: destination } })} />
    </Card>
  </Page>;
}
