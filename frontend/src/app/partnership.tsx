import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api, type PharmacyInvitation } from '../api/client';
import { useProfile } from '../state/profile';
import { Back, Badge, Button, Card, Page, Text, colors, s } from '../components/ui';
import { CheckoutField } from '../components/checkout-field';
import { Icon } from '../components/icon';
import { ProfileLinks } from '../components/profile-links';
import { accountHome } from '../domain/public-access';

export default function Partnership() {
  const { profile, refreshProfile } = useProfile();
  const [invitations, setInvitations] = useState<PharmacyInvitation[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setInvitations([]); setIssue(''); if (profile) api.pharmacyInvitations().then(rows => { if (active) setInvitations(rows); }).catch(error => { if (active) setIssue(error.message); }); return () => { active = false; }; }, [profile?.email, attempt]);
  const approved = profile?.pharmacyStatus === 'Approved';
  return <Page><Back title="Partner with MediFind" onBack={() => router.replace(accountHome(profile))} />
    <Card><Icon name="pharmacy" size={36} /><Text style={s.heading}>Bring your pharmacy to MediFind</Text><Text style={s.text}>Let customers find your branch, compare medicine availability, and send orders and prescriptions for your team to review.</Text>
      <View style={{ gap: 14 }}>{['Apply with your branch details and documents.', 'Track admin feedback and supply any missing information.', 'After approval, list medicines and manage orders.', 'Invite staff to join your branch.'].map((text, index) => <View key={text} style={{ flexDirection: 'row', gap: 12 }}><Badge text={String(index + 1)} /><Text style={[s.text, { flex: 1 }]}>{text}</Text></View>)}</View>
    </Card>
    <Card><Text style={s.heading}>What you will need</Text>{['Registered branch name, address, contact number, and opening hours', 'Current FDA license to operate', 'Business permit', 'Responsible pharmacist credentials'].map(text => <View key={text} style={{ flexDirection: 'row', gap: 10 }}><Icon name="check" size={20} /><Text style={[s.text, { flex: 1 }]}>{text}</Text></View>)}<Text style={s.muted}>Upload PDF, PNG, or JPEG documents up to 10 MB each. You can save a draft before submitting.</Text>
      <Button title={approved ? 'Pharmacy dashboard' : profile?.pharmacyStatus ? 'My pharmacy application' : 'Start application'} icon="pharmacy" onPress={() => router.push(profile ? '/partner' : { pathname: '/account/sign-in', params: { returnTo: '/partner' } })} />
    </Card>
    <Card><Text style={s.heading}>Joining an existing pharmacy?</Text><Text style={s.muted}>Ask the branch owner to invite your account email. Sign in and enter the invitation code the owner shares directly with you. Pharmacists need admin verification before prescription review is enabled.</Text>
      {!profile && <Button title="Sign in" secondary onPress={() => router.push({ pathname: '/account/sign-in', params: { returnTo: '/partnership' } })} />}
      {!!issue && <><Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text><Button title="Retry invitations" secondary onPress={() => setAttempt(value => value + 1)} /></>}
      {invitations.map(invitation => <View key={invitation.id} style={{ gap: 10, borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }}><Text style={s.heading}>{invitation.pharmacy}</Text><Text style={s.muted}>Invited as {invitation.role}. Expires {new Date(invitation.expires_at).toLocaleDateString()}.</Text><CheckoutField label="Invitation code" value={codes[invitation.id] || ''} onChangeText={value => setCodes(previous => ({ ...previous, [invitation.id]: value }))} autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={100} />{invitation.requires_renewal && <Text style={s.muted}>Ask the branch owner to renew this invitation and share the new code.</Text>}<Button title="Accept invitation" disabled={busy || !!profile?.pharmacyStatus || !codes[invitation.id]?.trim() || invitation.requires_renewal} onPress={async () => { setBusy(true); setIssue(''); try { await api.pharmacyAcceptInvitation(invitation.id, codes[invitation.id].trim()); await refreshProfile(); router.replace('/partner'); } catch (error) { setIssue(error instanceof Error ? error.message : 'Could not accept invitation.'); } finally { setBusy(false); } }} /></View>)}
    </Card><ProfileLinks />
  </Page>;
}
