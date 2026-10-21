import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, Switch, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '../components/icon';
import { Back, Badge, Button, Card, DetailRow, Page, Text, TextLink, colors, s } from '../components/ui';
import { CheckoutField } from '../components/checkout-field';
import { ProfileLinks } from '../components/profile-links';
import { useProfile } from '../state/profile';
import { reviewRecord, reviewCounts, type MedicineReviewStatus } from '../domain/admin';
import { api, ApiError, type AdminPharmacy, type AdminMedicine, type AdminEvent, type AdminDocument } from '../api/client';

type Status = AdminPharmacy['status'];
type Pharmacy = AdminPharmacy & { date: string };
type Medicine = AdminMedicine & { date: string };
type Tab = 'dashboard' | 'pharmacies' | 'catalog' | 'profile';
const displayDate = (value: string) => new Date(value).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
const pharmacyRow = (row: AdminPharmacy): Pharmacy => ({ ...row, date: displayDate(row.created_at) });
const medicineRow = (row: AdminMedicine): Medicine => ({ ...row, date: displayDate(row.created_at) });
const a = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stack: { gap: 8, flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  icon: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#AEBFB7', borderRadius: 8, paddingHorizontal: 14, backgroundColor: colors.white },
  filter: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
});
function StatusBadge({ status }: { status: string }) {
  if (status === 'Rejected') return <View style={{ backgroundColor: '#FCECEB', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' }}><Text style={[s.caption, { color: colors.danger }]}>{status}</Text></View>;
  return <Badge text={status} warning={status === 'Pending'} neutral={status === 'Needs Info'} />;
}
function IconTile({ name }: { name: IconName }) { return <View style={a.icon}><Icon name={name} size={26} /></View>; }
function Filters<T extends string>({ values, selected, onChange }: { values: readonly T[]; selected: T; onChange: (value: T) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
    {values.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === selected }} onPress={() => onChange(value)} style={({ pressed }) => [a.filter, value === selected && { backgroundColor: colors.pale, borderColor: colors.teal }, pressed && { opacity: 0.75 }]}><Text style={[s.link, { color: value === selected ? colors.teal : colors.muted }]}>{value}</Text></Pressable>)}
  </ScrollView>;
}
function RecordSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <View style={a.search}><Icon name="search" size={22} color={colors.muted} /><TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={colors.muted} value={value} onChangeText={onChange} autoCorrect={false} style={s.input} />{!!value && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} style={{ minHeight: 48, minWidth: 36, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} color={colors.muted} /></Pressable>}</View>;
}
function History({ events }: { events: AdminEvent[] }) {
  return <Card><Text style={s.heading}>Review history</Text>{events.length ? events.map(event => <View key={event.id} style={{ gap: 6, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line }}><View style={s.between}><StatusBadge status={event.status} /><Text style={s.caption}>{new Date(event.created_at).toLocaleString('en-PH')}</Text></View><Text style={s.muted}>{event.actor_email}</Text>{!!event.previous_status && <Text style={s.muted}>Previously {event.previous_status}</Text>}{!!event.notes && <Text style={s.text}>{event.notes}</Text>}</View>) : <Text style={s.muted}>No review actions yet.</Text>}</Card>;
}
export function AdminWorkspace() {
  const { profile, signOut } = useProfile();
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmation, setConfirmation] = useState<{ title: string; body: string; run: () => Promise<void> } | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [medicineId, setMedicineId] = useState<string | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status>('Pending');
  const [catalogFilter, setCatalogFilter] = useState<MedicineReviewStatus>('Pending');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGeneric, setNewGeneric] = useState('');
  const [newStrength, setNewStrength] = useState('');
  const [newForm, setNewForm] = useState('');
  const [newUnit, setNewUnit] = useState('unit');
  const [newRx, setNewRx] = useState(true);
  const [newPharmacy, setNewPharmacy] = useState('');
  const wide = useWindowDimensions().width >= 760;
  const { tab: routeTab } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    const next: Tab = routeTab === 'pharmacies' || routeTab === 'catalog' || routeTab === 'profile' ? routeTab : 'dashboard';
    setTab(next); setDetailId(null); setMedicineId(null); setSearch(''); setAdding(false); setNotice(''); setNotes('');
  }, [routeTab]);
  const detail = pharmacies.find(p => p.id === detailId);
  const medicine = medicines.find(m => m.id === medicineId);
  const pendingMedCount = medicines.filter(m => m.status === 'Pending').length;
  const filteredPharmacies = useMemo(() => pharmacies.filter(p => p.status === statusFilter && `${p.name} ${p.address}`.toLowerCase().includes(search.toLowerCase())), [pharmacies, search, statusFilter]);
  const filteredMedicines = useMemo(() => medicines.filter(m => m.status === catalogFilter && `${m.name} ${m.pharmacy}`.toLowerCase().includes(search.toLowerCase())), [medicines, search, catalogFilter]);
  const pharmacyCounts = reviewCounts(pharmacies);
  const medicineCounts = reviewCounts(medicines);
  function move(next: Tab) { setNotice(''); setNotes(''); setTab(next); setDetailId(null); setMedicineId(null); setSearch(''); setAdding(false); router.setParams({ tab: next }); }
  function selectPharmacy(p: Pharmacy) { setNotice(''); setDetailId(p.id); setNotes(p.notes || ''); setLatitude(p.point ? String(p.point.lat) : ''); setLongitude(p.point ? String(p.point.lon) : ''); }
  useEffect(() => {
    let live = true;
    setLoading(true); setLoadError('');
    Promise.all([api.adminPharmacies(), api.adminMedicines()]).then(([p, m]) => {
      if (live) { setPharmacies(p.map(pharmacyRow)); setMedicines(m.map(medicineRow)); }
    }).catch(error => { if (live) setLoadError(error instanceof Error ? error.message : 'Could not load administration records.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refreshKey]);
  const activity = [...pharmacies.flatMap(p => p.history.map(event => ({ ...event, name: p.name }))), ...medicines.flatMap(m => m.history.map(event => ({ ...event, name: m.name })))].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  function failure(error: unknown) {
    setNotice(error instanceof Error ? error.message : 'The action could not be saved.');
    if (error instanceof ApiError && error.status === 409) { setDetailId(null); setMedicineId(null); setRefreshKey(v => v + 1); }
  }
  async function openDocument(document: AdminDocument) {
    if (Platform.OS !== 'web') { setNotice('Open the staff web portal to download supporting documents.'); return; }
    setBusy(true);
    try {
      const blob = await api.adminDocument(document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url; link.download = document.name; window.document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { failure(error); } finally { setBusy(false); }
  }
  function updatePharmacy(status: 'Needs Info' | 'Approved' | 'Rejected') {
    if (!detail || busy) return;
    try {
      reviewRecord(detail, status, notes);
      setConfirmation({ title: `${status === 'Approved' ? 'Approve' : status === 'Rejected' ? 'Reject' : 'Request information for'} pharmacy?`, body: 'Final decisions cannot be changed. Your notes will be saved to review history.', run: async () => {
        const updated = pharmacyRow(await api.adminReviewPharmacy(detail.id, { status, notes, version: detail.version }));
        setPharmacies(prev => prev.map(p => p.id === detail.id ? updated : p));
        setDetailId(null); setStatusFilter(status); setNotice(`${detail.name}: ${status}. Decision saved.`);
      } });
    } catch (error) { failure(error); }
  }
  async function savePharmacyLocation() {
    if (!detail || busy) return;
    const lat = Number(latitude), lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) { setNotice('Enter a valid latitude and longitude.'); return; }
    setBusy(true);
    try { const updated = pharmacyRow(await api.adminSetPharmacyLocation(detail.id, { latitude: lat, longitude: lon })); setPharmacies(prev => prev.map(p => p.id === detail.id ? updated : p)); setNotice('Verified pharmacy map location saved.'); }
    catch (error) { failure(error); } finally { setBusy(false); }
  }
  function updateMedicine(status: 'Approved' | 'Rejected') {
    if (!medicine || busy) return;
    try {
      reviewRecord(medicine, status, notes);
      setConfirmation({ title: `${status === 'Approved' ? 'Approve' : 'Reject'} medicine?`, body: 'This decision is final. Stock and prices are managed separately.', run: async () => {
        const updated = medicineRow(await api.adminReviewMedicine(medicine.id, { status, notes, version: medicine.version }));
        setMedicines(prev => prev.map(m => m.id === medicine.id ? updated : m));
        setMedicineId(null); setCatalogFilter(status); setNotice(`${medicine.name}: ${status}. Decision saved.`);
      } });
    } catch (error) { failure(error); }
  }
  async function addMedicine() {
    if (!newName.trim() || !newGeneric.trim() || !newStrength.trim() || !newForm.trim() || !newUnit.trim() || !newPharmacy) { setNotice('Enter the medicine name, strength/form, and select an approved pharmacy.'); return; }
    setBusy(true);
    try {
      const created = medicineRow(await api.adminCreateMedicine({ name: newName.trim(), description: `${newStrength.trim()} - ${newForm.trim()}`, generic: newGeneric.trim(), strength: newStrength.trim(), form: newForm.trim(), unit: newUnit.trim(), prescription: newRx, pharmacy_id: newPharmacy }));
      setMedicines(prev => [created, ...prev]); setNewName(''); setNewGeneric(''); setNewStrength(''); setNewForm(''); setNewUnit('unit'); setNewRx(true); setNewPharmacy(''); setAdding(false); setCatalogFilter('Pending'); setNotice('Medicine request saved for review.');
    } catch (error) { failure(error); } finally { setBusy(false); }
  }
  const back = () => { setDetailId(null); setMedicineId(null); setNotice(''); setNotes(''); };
  const title = detail ? 'Application details' : medicine ? 'Medicine request' : tab === 'dashboard' ? 'Dashboard' : tab === 'pharmacies' ? 'Pharmacy applications' : tab === 'catalog' ? 'Medicine catalog' : 'Admin profile';
  const refresh = () => { if (!busy) setRefreshKey(value => value + 1); };
  return <>
    <Page scrollKey={`admin-${detail?.id ?? medicine?.id ?? tab}`}>
      <View style={[s.between, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, minWidth: 200, gap: 8 }}>{detail || medicine ? <Back title={title} onBack={back} /> : <><Text accessibilityRole="header" style={s.title}>{title}</Text></>}</View>
        <TextLink title={loading ? 'Refreshing...' : 'Refresh'} icon="clock" onPress={() => { if (!loading) refresh(); }} />
      </View>
      {!!notice && <Card><View style={a.row}><Icon name="alert" size={22} /><Text accessibilityRole="alert" style={[s.text, { flex: 1 }]}>{notice}</Text></View></Card>}
      {loading && <View style={a.row}><ActivityIndicator accessibilityLabel="Loading administration records" color={colors.teal} /><Text style={s.muted}>Loading records...</Text></View>}
      {!!loadError && <Card><Text accessibilityRole="alert" style={[s.text, { color: colors.danger }]}>{loadError}</Text><Button title="Try again" secondary onPress={refresh} /></Card>}
      {busy && !confirmation && <Text accessibilityRole="alert" style={s.muted}>Saving or downloading...</Text>}
      {!loading && !loadError && <>
        {tab === 'dashboard' && !detail && !medicine && <>
          <Card><View style={a.row}><IconTile name="profile" /><View style={a.stack}><Text style={s.heading}>Welcome, {profile?.fullName || 'Administrator'}</Text></View></View></Card>
          <View style={{ gap: 16 }}><View style={a.grid}>
            {([
              { label: 'Pending pharmacies', value: pharmacyCounts.pending, icon: 'pharmacy', onPress: () => { move('pharmacies'); setStatusFilter('Pending'); } },
              { label: 'Approved pharmacies', value: pharmacyCounts.approved, icon: 'pharmacy', onPress: () => { move('pharmacies'); setStatusFilter('Approved'); } },
              { label: 'Pending medicines', value: pendingMedCount, icon: 'medicine', onPress: () => { move('catalog'); setCatalogFilter('Pending'); } },
              { label: 'Approved medicines', value: medicineCounts.approved, icon: 'medicine', onPress: () => { move('catalog'); setCatalogFilter('Approved'); } },
            ] as { label: string; value: number; icon: IconName; onPress: () => void }[]).map(stat => <View key={stat.label} style={{ flexBasis: wide ? '22%' : '44%', flexGrow: 1 }}><Pressable accessibilityRole="link" accessibilityLabel={`${stat.label}: ${stat.value}`} onPress={stat.onPress} style={({ pressed }) => [s.card, { opacity: pressed ? 0.75 : 1 }]}><Icon name={stat.icon} size={24} /><Text style={[s.title, { fontSize: 28, lineHeight: 36 }]}>{stat.value}</Text><Text style={s.muted}>{stat.label}</Text></Pressable></View>)}
          </View></View>
          <Card><Text style={s.heading}>Recent activity</Text>{activity.length ? activity.map(event => <View key={event.id} style={{ gap: 6, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line }}><View style={s.between}><Text style={[s.text, { flexShrink: 1, fontWeight: '600' }]}>{event.name}</Text><StatusBadge status={event.status} /></View><Text style={s.muted}>{event.actor_email}</Text><Text style={s.caption}>{new Date(event.created_at).toLocaleString('en-PH')}</Text></View>) : <Text style={s.muted}>No review actions yet.</Text>}</Card>
        </>}
        {tab === 'pharmacies' && !detail && <>
        <View style={{ gap: 16 }}><RecordSearch value={search} onChange={setSearch} placeholder="Search pharmacy or location" /><Filters values={['Draft', 'Pending', 'Needs Info', 'Approved', 'Rejected'] as const} selected={statusFilter} onChange={setStatusFilter} /><Text style={s.muted}>{filteredPharmacies.length} applications</Text></View>
          {filteredPharmacies.map(p => <Card key={p.id}><View style={[a.row, { alignItems: 'flex-start' }]}><IconTile name="pharmacy" /><View style={a.stack}><View style={s.between}><Text style={[s.heading, { flexShrink: 1 }]}>{p.name}</Text><StatusBadge status={p.status} /></View><Text style={s.muted}>{p.address}</Text><Text style={s.caption}>Submitted {p.date}</Text></View></View><Button title={p.status === 'Pending' || p.status === 'Needs Info' ? 'Review application' : 'View application'} secondary icon="arrow-right" onPress={() => selectPharmacy(p)} /></Card>)}
          {!filteredPharmacies.length && <Card><IconTile name="pharmacy" /><Text style={s.heading}>No applications found</Text><Text style={s.muted}>{search ? 'Try another pharmacy name or location.' : 'Try another status.'}</Text></Card>}
        </>}
        {detail && <>
          <Card><View style={[a.row, { alignItems: 'flex-start' }]}><IconTile name="pharmacy" /><View style={a.stack}><Text style={s.heading}>{detail.name}</Text><Text style={s.muted}>{detail.address}</Text><Text style={s.caption}>Submitted {detail.date}</Text></View><StatusBadge status={detail.status} /></View></Card>
          <Card><Text style={s.heading}>Pharmacy information</Text>{[['Application ID', detail.id], ['Applicant', detail.applicant], ['Email', detail.email], ['Contact numbers', detail.contact_numbers?.join(', ') || detail.phone || 'Not provided'], ['Opening hours', detail.hours || 'Not provided']].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</Card>
          <Card><Text style={s.heading}>Map location</Text><Text style={s.muted}>{detail.point ? 'A verified pin is shown to customers.' : 'Set and verify this branch pin before customers rely on its map location.'}</Text><View style={a.row}><View style={{ flex: 1 }}><CheckoutField label="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="decimal-pad" editable={!busy} placeholder="e.g. 8.4772" /></View><View style={{ flex: 1 }}><CheckoutField label="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="decimal-pad" editable={!busy} placeholder="e.g. 124.6470" /></View></View><Button title={detail.point ? 'Update verified pin' : 'Verify map pin'} secondary icon="map-pin" disabled={busy} onPress={() => void savePharmacyLocation()} /></Card>
          <Card><Text style={s.heading}>Supporting documents</Text>{detail.documents.map(document => <View key={document.id} style={[s.between, { paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line }]}><View style={[a.row, { flex: 1 }]}><Icon name="prescription" size={22} color={colors.muted} /><Text style={[s.text, { flex: 1 }]}>{document.name}</Text></View><Button title="Download" secondary disabled={busy} onPress={() => void openDocument(document)} /></View>)}{!detail.documents.length && <Text style={s.muted}>No documents attached.</Text>}<Text style={s.muted}>Review the FDA license, business permit, and pharmacist credentials before approval.</Text></Card>
          {['Pending', 'Needs Info'].includes(detail.status) ? <Card><Text style={s.heading}>Review application</Text><CheckoutField label="Review notes" multiline value={notes} onChangeText={setNotes} maxLength={1000} editable={!busy} style={{ minHeight: 120 }} placeholder="Enter findings or information needed" /><Text style={s.muted}>A reason is required for rejection or information requests.</Text><Button title="Approve pharmacy" icon="pharmacy" disabled={busy} onPress={() => updatePharmacy('Approved')} /><View style={s.row}><View style={{ flex: 1, minWidth: 130 }}><Button title="Request information" secondary disabled={busy} onPress={() => updatePharmacy('Needs Info')} /></View><View style={{ flex: 1, minWidth: 130 }}><Button title="Reject application" secondary disabled={busy} onPress={() => updatePharmacy('Rejected')} /></View></View></Card> : null}
          <History events={detail.history} />
        </>}
        {tab === 'catalog' && !medicine && <>
          <View style={{ gap: 16 }}><RecordSearch value={search} onChange={setSearch} placeholder="Search medicine or pharmacy" /><Filters values={['Pending', 'Approved', 'Rejected'] as const} selected={catalogFilter} onChange={setCatalogFilter} /><View style={s.between}><Text style={s.muted}>{filteredMedicines.length} medicines</Text><Button title={adding ? 'Close form' : 'Add medicine'} secondary icon={adding ? 'close' : 'plus'} disabled={busy} onPress={() => setAdding(value => !value)} /></View></View>
          {adding && <Card><Text style={s.heading}>Add medicine request</Text><CheckoutField label="Medicine name" value={newName} onChangeText={setNewName} maxLength={150} editable={!busy} /><CheckoutField label="Generic name" value={newGeneric} onChangeText={setNewGeneric} maxLength={150} editable={!busy} /><CheckoutField label="Strength" value={newStrength} onChangeText={setNewStrength} maxLength={100} editable={!busy} /><CheckoutField label="Form" value={newForm} onChangeText={setNewForm} maxLength={80} editable={!busy} /><CheckoutField label="Unit" value={newUnit} onChangeText={setNewUnit} maxLength={40} editable={!busy} /><View style={s.between}><Text style={s.text}>Prescription required</Text><Switch accessibilityLabel="Prescription required" value={newRx} onValueChange={setNewRx} disabled={busy} /></View><Text style={s.muted}>Select an approved pharmacy</Text>{pharmacies.filter(p => p.status === 'Approved').map(p => <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: newPharmacy === p.id, disabled: busy }} disabled={busy} onPress={() => setNewPharmacy(p.id)} style={[s.card, { padding: 16 }, newPharmacy === p.id && { borderColor: colors.teal, backgroundColor: colors.pale }]}><View style={a.row}><Icon name="pharmacy" size={22} /><View style={a.stack}><Text style={[s.text, { fontWeight: '600' }]}>{p.name}</Text><Text style={s.muted}>{p.address}</Text></View><Text style={[s.link, { flexShrink: 0 }]}>{newPharmacy === p.id ? 'Selected' : 'Select'}</Text></View></Pressable>)}{!pharmacies.some(p => p.status === 'Approved') && <Text style={s.muted}>Approve a pharmacy application before creating medicine requests.</Text>}<Button title={busy ? 'Saving...' : 'Save medicine request'} icon="plus" disabled={busy || !pharmacies.some(p => p.status === 'Approved')} onPress={() => void addMedicine()} /></Card>}
          {filteredMedicines.map(m => <Card key={m.id}><View style={[a.row, { alignItems: 'flex-start' }]}><IconTile name="medicine" /><View style={a.stack}><View style={s.between}><Text style={[s.heading, { flexShrink: 1 }]}>{m.name}</Text><StatusBadge status={m.status} /></View><Text style={s.text}>{m.description}</Text><Text style={s.muted}>{m.pharmacy}</Text><Text style={s.caption}>Submitted {m.date}</Text></View></View><Button title={m.status === 'Pending' ? 'Review request' : 'View medicine'} secondary icon="arrow-right" onPress={() => { setMedicineId(m.id); setNotes(m.notes || ''); setNotice(''); }} /></Card>)}
          {!filteredMedicines.length && <Card><IconTile name="medicine" /><Text style={s.heading}>No medicines found</Text><Text style={s.muted}>{search ? 'Try another medicine or pharmacy name.' : 'Try another status or add a medicine.'}</Text></Card>}
        </>}
        {medicine && <>
          <Card><View style={s.between}><Text style={[s.heading, { flexShrink: 1 }]}>{medicine.name}</Text><StatusBadge status={medicine.status} /></View>{[['Strength / form', medicine.description], ['Generic', medicine.generic || 'Not supplied'], ['Classification', medicine.prescription === false ? 'OTC' : 'Prescription required'], ['Unit', medicine.unit || 'unit'], ['Pharmacy', medicine.pharmacy], ['Submitted', medicine.date], ['Request ID', medicine.id]].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}<Text style={s.muted}>Verify product and regulatory information before approval. Catalog approval does not set stock or prices.</Text></Card>
          {medicine.status === 'Pending' ? <Card><Text style={s.heading}>Review medicine</Text><CheckoutField label="Review notes" multiline value={notes} onChangeText={setNotes} maxLength={1000} editable={!busy} style={{ minHeight: 120 }} placeholder="Enter your review findings" /><Text style={s.muted}>A reason is required for rejection.</Text><Button title="Approve medicine" icon="medicine" disabled={busy} onPress={() => updateMedicine('Approved')} /><Button title="Reject request" secondary disabled={busy} onPress={() => updateMedicine('Rejected')} /></Card> : null}
          <History events={medicine.history} />
        </>}
        {tab === 'profile' && <>
          <Card><View style={a.row}><View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name="profile" size={30} /></View><View style={a.stack}><Text style={s.heading}>{profile?.fullName || 'Administrator'}</Text><Text style={s.muted}>{profile?.email}</Text></View></View><Badge text="Staff account" /></Card>
          <Card><Text style={s.heading}>Account</Text><Button title="Go to customer home" secondary icon="home" onPress={() => router.replace('/home')} /><Button title="Go to guest home" secondary onPress={() => router.replace('/')} /><Button title="Sign out" secondary disabled={busy} onPress={async () => { await signOut(); router.replace('/'); }} /></Card><ProfileLinks />
        </>}
      </>}
    </Page>
    <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmation(null); }}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#162A2480', padding: 20 }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}><Card><Text accessibilityRole="header" style={s.heading}>{confirmation?.title}</Text><Text style={s.text}>{confirmation?.body}</Text><Button title={busy ? 'Saving...' : 'Confirm decision'} disabled={busy} onPress={async () => { if (busy || !confirmation) return; setBusy(true); try { await confirmation.run(); setConfirmation(null); } catch (error) { failure(error); setConfirmation(null); } finally { setBusy(false); } }} /><Button title="Cancel" secondary disabled={busy} onPress={() => setConfirmation(null)} /></Card></View></View>
    </Modal>
  </>;
}
