import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { api, ApiError, type RiderApplication } from '../api/client';
import { Icon } from './icon';
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
    <View style={{ gap: 16 }}>
    {!detail && <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#AEBFB7', borderRadius: 8, paddingLeft: 14, paddingRight: 8, backgroundColor: colors.white }}>
        <Icon name="search" size={20} color={colors.muted} />
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
        <TextInput accessibilityLabel="Search rider applications" placeholder="Search name, email, or service area" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false} style={[s.input, { minHeight: 46, paddingVertical: 8, borderWidth: 0, paddingLeft: 0 }]} />
      </View>
    </View>}
    {!!notice && <Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
    {!!error && <Card><Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>{!detail && <Button title="Reload applications" secondary onPress={() => setAttempt(v => v + 1)} />}</Card>}
    {loading ? <ActivityIndicator accessibilityLabel="Loading rider applications" color={colors.teal} /> : detail ? <>
      <Button title="Back to rider applications" secondary disabled={busy} onPress={() => { setSelected(null); setError(''); }} />
      <Card><View style={s.between}><Text style={s.heading}>{detail.full_name}</Text><Badge text={detail.status} warning={detail.status === 'Pending'} /></View>{[['Email', detail.email], ['Mobile number', detail.phone], ['Vehicle', detail.vehicle], ['Plate number', detail.plate_number || 'Not provided'], ['Service area', detail.service_area], ['Submitted', new Date(detail.submitted_at).toLocaleString('en-PH')]].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</Card>
      {detail.status === 'Pending' && <Card><Text style={s.heading}>Review rider application</Text><CheckoutField label="Review notes (required for rejection)" value={notes} onChangeText={setNotes} editable={!busy} multiline maxLength={1000} /><Button title="Approve rider" disabled={busy} onPress={() => review('Approved')} /><Button title="Reject application" secondary disabled={busy} onPress={() => review('Rejected')} /></Card>}
      <Card><Text style={s.heading}>Application history</Text>{detail.history.map(event => <View key={event.id} style={{ gap: 5 }}><Badge text={event.status} warning={event.status === 'Pending'} /><Text style={s.caption}>{new Date(event.created_at).toLocaleString('en-PH')}</Text>{!!event.notes && <Text style={s.muted}>{event.notes}</Text>}</View>)}</Card>
    </> : <>
      <View style={{ gap: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{(['Pending', 'Approved', 'Rejected'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: status === value }} onPress={() => setStatus(value)} style={({ pressed }) => [{ minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: status === value ? colors.teal : colors.line, borderRadius: 8, backgroundColor: status === value ? colors.pale : colors.white }, pressed && { opacity: 0.75 }]}><Text style={[s.link, { color: status === value ? colors.teal : colors.muted }]}>{value}</Text></Pressable>)}</ScrollView>
        <Text style={s.caption}>{filtered.length} {filtered.length === 1 ? 'application' : 'applications'}</Text>
      </View>
      {filtered.map(row => <Card key={row.id}><View style={s.between}><Text style={s.heading}>{row.full_name}</Text><Badge text={row.status} warning={row.status === 'Pending'} /></View><Text style={s.muted}>{row.vehicle} | {row.service_area}</Text><Text style={s.caption}>{row.email}</Text><Button title={row.status === 'Pending' ? 'Review application' : 'View application'} secondary onPress={() => { setSelected(row.id); setNotes(''); setError(''); setNotice(''); }} /></Card>)}
      {!filtered.length && <Card><Text style={s.heading}>No rider applications found</Text><Text style={s.muted}>{query.trim() ? 'Try a different search.' : `There are no ${status.toLowerCase()} applications.`}</Text></Card>}
    </>}
    <Modal visible={!!decision} transparent animationType="fade" onRequestClose={() => { if (!busy) setDecision(null); }}><View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#162A2480', padding: 20 }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}><Card><Text style={s.heading}>{decision === 'Approved' ? 'Approve this rider?' : 'Reject this application?'}</Text><Text style={s.muted}>{decision === 'Approved' ? 'The applicant will gain access to rider deliveries. They must set availability before receiving assignments.' : 'Your review notes will be visible to the applicant. They can correct their details and resubmit.'}</Text><Button title={busy ? 'Saving...' : 'Confirm decision'} disabled={busy} onPress={confirm} /><Button title="Cancel" secondary disabled={busy} onPress={() => setDecision(null)} /></Card></View></View></Modal>
    </View>
  </>;
}
