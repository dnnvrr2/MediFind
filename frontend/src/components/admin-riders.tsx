import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';
import { api, ApiError, type RiderApplication } from '../api/client';
import { Badge, Button, Card, DetailRow, Text, colors, s } from './ui';
import { CheckoutField } from './checkout-field';

export function AdminRiders({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<RiderApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<RiderApplication['status']>('Pending');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<'Approved' | 'Rejected' | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const detail = rows.find(row => row.id === selected);
  useEffect(() => {
    let live = true; setLoading(true); setError(''); setSelected(null); setDecision(null);
    api.adminRiderApplications().then(value => { if (live) setRows(value); }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'Could not load rider applications.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refreshKey, attempt]);
  function review(value: 'Approved' | 'Rejected') {
    setError('');
    if (value === 'Rejected' && !notes.trim()) { setError('Enter a reason before rejecting the application.'); return; }
    setDecision(value);
  }
  async function confirm() {
    if (!detail || !decision || busy) return;
    setBusy(true); setError('');
    try {
      const updated = await api.adminReviewRider(detail.id, { status: decision, notes: notes.trim(), version: detail.version });
      setRows(previous => previous.map(row => row.id === updated.id ? updated : row));
      setNotice(`${updated.full_name}: ${updated.status}. Decision saved.`); setSelected(null); setStatus(updated.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the decision.');
      if (e instanceof ApiError && e.status === 409) setAttempt(value => value + 1);
    } finally { setBusy(false); setDecision(null); }
  }
  const filtered = rows.filter(row => row.status === status && `${row.full_name} ${row.email} ${row.service_area}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <Button title="Refresh applications" secondary disabled={busy || loading} onPress={() => setAttempt(v => v + 1)} />
    {!!notice && <Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
    {!!error && <Card><Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>{!detail && <Button title="Reload applications" secondary onPress={() => setAttempt(v => v + 1)} />}</Card>}
    {loading ? <ActivityIndicator accessibilityLabel="Loading rider applications" color={colors.teal} /> : detail ? <>
      <Button title="Back to rider applications" secondary disabled={busy} onPress={() => { setSelected(null); setError(''); }} />
      <Card><View style={s.between}><Text style={s.heading}>{detail.full_name}</Text><Badge text={detail.status} warning={detail.status === 'Pending'} /></View>{[['Email', detail.email], ['Mobile number', detail.phone], ['Vehicle', detail.vehicle], ['Plate number', detail.plate_number || 'Not provided'], ['Service area', detail.service_area], ['Submitted', new Date(detail.submitted_at).toLocaleString('en-PH')]].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</Card>
      {detail.status === 'Pending' && <Card><Text style={s.heading}>Review rider application</Text><CheckoutField label="Review notes (required for rejection)" value={notes} onChangeText={setNotes} editable={!busy} multiline maxLength={1000} /><Button title="Approve rider" disabled={busy} onPress={() => review('Approved')} /><Button title="Reject application" secondary disabled={busy} onPress={() => review('Rejected')} /></Card>}
      <Card><Text style={s.heading}>Application history</Text>{detail.history.map(event => <View key={event.id} style={{ gap: 5 }}><Badge text={event.status} warning={event.status === 'Pending'} /><Text style={s.caption}>{new Date(event.created_at).toLocaleString('en-PH')}</Text>{!!event.notes && <Text style={s.muted}>{event.notes}</Text>}</View>)}</Card>
    </> : <>
      <CheckoutField label="Search rider applications" placeholder="Name, email, or service area" value={query} onChangeText={setQuery} />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{(['Pending', 'Approved', 'Rejected'] as const).map(value => <Button key={value} title={value} secondary={status !== value} onPress={() => setStatus(value)} />)}</ScrollView>
      <Text style={s.muted}>{filtered.length} application(s)</Text>
      {filtered.map(row => <Card key={row.id}><View style={s.between}><Text style={s.heading}>{row.full_name}</Text><Badge text={row.status} warning={row.status === 'Pending'} /></View><Text style={s.muted}>{row.vehicle} | {row.service_area}</Text><Text style={s.caption}>{row.email}</Text><Button title={row.status === 'Pending' ? 'Review application' : 'View application'} secondary onPress={() => { setSelected(row.id); setNotes(''); setError(''); setNotice(''); }} /></Card>)}
      {!filtered.length && <Card><Text style={s.heading}>No rider applications found</Text><Text style={s.muted}>Try another status or search.</Text></Card>}
    </>}
    <Modal visible={!!decision} transparent animationType="fade" onRequestClose={() => { if (!busy) setDecision(null); }}><View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#162A2480', padding: 20 }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}><Card><Text style={s.heading}>{decision === 'Approved' ? 'Approve this rider?' : 'Reject this application?'}</Text><Text style={s.muted}>{decision === 'Approved' ? 'The applicant will gain access to rider deliveries. They must set availability before receiving assignments.' : 'Your review notes will be visible to the applicant. They can correct their details and resubmit.'}</Text><Button title={busy ? 'Saving...' : 'Confirm decision'} disabled={busy} onPress={confirm} /><Button title="Cancel" secondary disabled={busy} onPress={() => setDecision(null)} /></Card></View></View></Modal>
  </>;
}
