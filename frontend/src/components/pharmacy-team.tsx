import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, type PharmacyInvitation } from '../api/client';
import { Button, Card, Text, colors, s } from './ui';
import { CheckoutField } from './checkout-field';

export function PharmacyTeamInvitations() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'pharmacist'>('staff');
  const [rows, setRows] = useState<PharmacyInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [issue, setIssue] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; api.pharmacyInvitations(true).then(items => { if (active) { setRows(items); setIssue(''); } }).catch(error => { if (active) setIssue(error.message); }); return () => { active = false; }; }, [attempt]);
  return <Card><Text style={s.heading}>Invite staff</Text><Text style={s.muted}>The invitation appears in Partner with MediFind when the employee signs in with this email. Share the generated code directly with the employee after confirming their identity. It expires in 7 days.</Text><CheckoutField label="Employee email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={254} /><View style={s.row}>{(['staff', 'pharmacist'] as const).map(value => <Button key={value} title={value === 'staff' ? 'Staff' : 'Pharmacist'} secondary={role !== value} disabled={busy} onPress={() => setRole(value)} />)}</View><Text style={s.caption}>Pharmacist invitations require separate admin verification for prescription review.</Text>
    {!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={s.muted}>{message}</Text>}{!!inviteCode && <View style={{ gap: 8 }}><Text style={s.caption}>Share this code directly with the employee. It is shown only now.</Text><Text selectable style={s.text}>{inviteCode}</Text></View>}
    <Button title="Create invitation" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onPress={async () => { setBusy(true); setIssue(''); setMessage(''); setInviteCode(''); try { const created = await api.pharmacyInvite(email.trim(), role); setInviteCode(created.acceptance_code || ''); setMessage('Invitation created for ' + email.trim() + '.'); setEmail(''); setAttempt(value => value + 1); } catch (error) { setIssue(error instanceof Error ? error.message : 'Could not invite staff.'); } finally { setBusy(false); } }} />
    {rows.map(row => <View key={row.id} style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line }}><Text style={s.text}>{row.email}</Text><Text style={s.muted}>{row.role} - expires {new Date(row.expires_at).toLocaleDateString()}</Text><Button title="Renew invitation code" secondary disabled={busy} onPress={async () => { setBusy(true); setIssue(''); try { const created = await api.pharmacyInvite(row.email, row.role); setInviteCode(created.acceptance_code || ''); setMessage('New code for ' + row.email + '. Previous codes no longer work.'); setAttempt(value => value + 1); } catch (error) { setIssue(error instanceof Error ? error.message : 'Could not renew invitation.'); } finally { setBusy(false); } }} /><Button title="Cancel invitation" secondary disabled={busy} onPress={async () => { setBusy(true); setIssue(''); try { await api.pharmacyCancelInvitation(row.id); setAttempt(value => value + 1); } catch (error) { setIssue(error instanceof Error ? error.message : 'Could not cancel invitation.'); } finally { setBusy(false); } }} /></View>)}
  </Card>;
}
