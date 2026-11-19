import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { api, type RiderApplicationInput, type RiderApplicationSession } from '../api/client';
import { Back, Badge, Button, Card, DetailRow, Page, Text, colors, s } from '../components/ui';
import { CheckoutField } from '../components/checkout-field';
import { useProfile } from '../state/profile';

const message = (error: unknown) => error instanceof Error ? error.message : 'Could not connect. Please try again.';

function ApplicationContent() {
  const { profile, refreshProfile } = useProfile();
  const [session, setSession] = useState<RiderApplicationSession | null>(null);
  const [form, setForm] = useState<RiderApplicationInput>({ full_name: profile?.fullName || '', phone: profile?.phone || '', vehicle: '', plate_number: '', service_area: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const value = await api.riderApplication(); setSession(value);
      if (value.application) {
        const { full_name, phone, vehicle, plate_number, service_area } = value.application;
        setForm({ full_name, phone, vehicle, plate_number, service_area });
      }
      if (value.approved) await refreshProfile();
    } catch (e) { setError(message(e)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const app = session?.application;
  const editable = !!session && !session.approved && (!app || app.status === 'Rejected');
  const phoneValid = /^(09\d{9}|\+639\d{9})$/.test(form.phone.trim().replace(/[\s().-]/g, ''));
  const valid = form.full_name.trim().length >= 2 && phoneValid && !!form.vehicle.trim() && !!form.service_area.trim();
  async function submit() {
    if (busy || !editable) return;
    setAttempted(true); if (!valid) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const application = await api.riderApply({ ...form, phone: form.phone.trim().replace(/[\s().-]/g, '') });
      setSession({ application, approved: false }); setNotice('Application submitted. An administrator will review your details.');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <Page><View style={s.between}><Back title="Rider application" onBack={() => router.replace('/profile')} /><Button title="Refresh status" secondary disabled={busy || loading} onPress={load} /></View>
    {loading && <ActivityIndicator accessibilityLabel="Loading rider application" color={colors.teal} />}
    {!!error && <Card><Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>{!session && <Button title="Try again" onPress={load} />}</Card>}
    {!!notice && <Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
    {!loading && session && <>
      <Card><View style={s.between}><Text style={s.heading}>{session.approved ? 'You are an approved rider' : app ? 'My rider application' : 'Apply as rider'}</Text>{app && <Badge text={app.status} warning={app.status === 'Pending'} />}</View>
        <Text style={s.muted}>{session.approved ? 'Open your dashboard and set your availability to receive assignments.' : app?.status === 'Pending' ? 'Your application is waiting for administrator review. Delivery access becomes available after approval.' : app?.status === 'Rejected' ? 'Review the feedback, correct your details, and submit again.' : 'Submit your contact, vehicle, and service-area details for administrator review.'}</Text>
        {!!app?.notes && <Text style={s.text}>Review feedback: {app.notes}</Text>}
        {session.approved && <Button title="Open rider dashboard" onPress={() => router.replace('/rider')} />}
      </Card>
      {editable ? <Card><Text style={s.heading}>Applicant details</Text><DetailRow label="Account email" value={profile?.email || ''} />
        <CheckoutField label="Full name *" value={form.full_name} maxLength={160} editable={!busy} autoCapitalize="words" error={attempted && form.full_name.trim().length < 2 ? 'Enter your full name.' : undefined} onChangeText={full_name => setForm(v => ({ ...v, full_name }))} />
        <CheckoutField label="Mobile number *" value={form.phone} maxLength={24} keyboardType="phone-pad" editable={!busy} error={attempted && !phoneValid ? 'Use 09XXXXXXXXX or +639XXXXXXXXX.' : undefined} onChangeText={phone => setForm(v => ({ ...v, phone }))} />
        <CheckoutField label="Vehicle *" value={form.vehicle} maxLength={80} editable={!busy} error={attempted && !form.vehicle.trim() ? 'Enter your vehicle.' : undefined} onChangeText={vehicle => setForm(v => ({ ...v, vehicle }))} />
        <CheckoutField label="Plate number (if applicable)" value={form.plate_number} maxLength={30} autoCapitalize="characters" editable={!busy} onChangeText={plate_number => setForm(v => ({ ...v, plate_number }))} />
        <CheckoutField label="Service area *" placeholder="City and barangays you can serve" value={form.service_area} maxLength={200} editable={!busy} error={attempted && !form.service_area.trim() ? 'Enter your service area.' : undefined} onChangeText={service_area => setForm(v => ({ ...v, service_area }))} />
        <Button title={busy ? 'Submitting...' : app ? 'Resubmit application' : 'Submit application'} disabled={busy} onPress={submit} />
      </Card> : app && <Card><Text style={s.heading}>Submitted details</Text>{[['Full name', app.full_name], ['Email', app.email], ['Mobile number', app.phone], ['Vehicle', app.vehicle], ['Plate number', app.plate_number || 'Not provided'], ['Service area', app.service_area]].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</Card>}
      {app && <Card><Text style={s.heading}>Application history</Text>{app.history.map(event => <View key={event.id} style={{ gap: 5 }}><Badge text={event.status} warning={event.status === 'Pending'} /><Text style={s.caption}>{new Date(event.created_at).toLocaleString('en-PH')}</Text>{!!event.notes && <Text style={s.muted}>{event.notes}</Text>}</View>)}</Card>}
    </>}
  </Page>;
}

export function RiderApplicationScreen() {
  const { ready, profile } = useProfile();
  if (!ready || !profile) return <Page><Text style={s.muted}>Sign in to apply as a rider.</Text></Page>;
  return <ApplicationContent key={profile.id ?? profile.email} />;
}
