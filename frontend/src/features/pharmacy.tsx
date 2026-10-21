import { useCallback, useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Pressable, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PharmacyBranchDetailsFields, usePharmacyBranchDetails } from '../components/pharmacy-branch-details';
import { PharmacyTeamInvitations } from '../components/pharmacy-team';
import { PharmacyApplicationForm } from '../components/pharmacy-application-form';
import { api, ApiError, type PharmacySession, type PharmacyApplication, type PharmacyMedicine, type PharmacyPrescription, type PharmacyOrderRecord, type PharmacyActivity } from '../api/client';
import { useProfile } from '../state/profile';
import { Back, Badge, Button, Card, DetailRow, Page, Text, TextLink, colors, s } from '../components/ui';
import { CheckoutField } from '../components/checkout-field';
import { ProfileLinks } from '../components/profile-links';
import { PrivateDocument } from '../components/private-document';
import { DestinationMap } from '../components/destination-map';
import { money } from '../data/catalog';
import { accountHome } from '../domain/public-access';
import { type OrderStatus } from '../domain/orders';

type Tab = 'dashboard' | 'inventory' | 'prescriptions' | 'orders' | 'profile';
const stateLabel = (value: string) => value.replace(/_/g, ' ').replace(/^./, v => v.toUpperCase());
const finished = (value: string) => ['collected', 'delivered', 'cancelled', 'rejected', 'delivery_failed', 'returned'].includes(value);
function Status({ value }: { value: string }) { return <Badge text={stateLabel(value)} warning={['Pending', 'Needs Info', 'pending', 'awaiting_confirmation'].includes(value)} neutral={['Draft', 'Rejected', 'rejected', 'cancelled'].includes(value)} />; }
function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) { return <View style={s.between}><Text style={[s.text, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} disabled={disabled} value={value} onValueChange={onChange} trackColor={{ true: colors.teal }} /></View>; }

function MedicineForm({ initial, busy, save, close }: { initial: PharmacyMedicine | null; busy: boolean; save: (data: Record<string, unknown>) => void; close: () => void }) {
  const [values, setValues] = useState({ name: initial?.name || '', generic: initial?.generic || '', strength: initial?.strength || '', form: initial?.form || '', unit: initial?.unit || 'tablet' });
  const [rx, setRx] = useState(initial?.prescription ?? true);
  return <Card><Text style={s.heading}>{initial ? 'Update medicine request' : 'Request a medicine'}</Text>{Object.entries(values).map(([key, value]) => <CheckoutField key={key} label={stateLabel(key)} value={value} onChangeText={text => setValues(prev => ({ ...prev, [key]: text }))} maxLength={100} editable={!busy} />)}<Toggle label="Prescription required" value={rx} onChange={setRx} disabled={busy} /><Text style={s.muted}>Product details and classification require admin approval before listing.</Text><Button title="Submit for review" disabled={busy || Object.values(values).some(value => !value.trim())} onPress={() => save({ ...values, prescription: rx, ...(initial ? { id: initial.id } : {}) })} /><Button title="Cancel" secondary disabled={busy} onPress={close} /></Card>;
}

function InventoryForm({ item, busy, save, close }: { item: PharmacyMedicine; busy: boolean; save: (id: string, data: Record<string, unknown>) => void; close: () => void }) {
  const [price, setPrice] = useState(item.inventory?.price || '');
  const [stock, setStock] = useState(String(item.inventory?.stock ?? 0));
  const [low, setLow] = useState(String(item.inventory?.low_stock ?? 10));
  const [available, setAvailable] = useState(item.inventory?.available ?? true);
  const version = item.inventory?.version ?? 0;
  const valid = /^\d+(\.\d{1,2})?$/.test(price) && /^\d+$/.test(stock) && /^\d+$/.test(low);
  return <Card><Text style={s.heading}>{item.name}</Text><Text style={s.muted}>{item.description}</Text><CheckoutField label={`Price per ${item.unit}`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" editable={!busy} /><CheckoutField label="Total stock on hand" value={stock} onChangeText={setStock} keyboardType="number-pad" editable={!busy} /><DetailRow label="Reserved" value={String(item.inventory?.reserved ?? 0)} /><CheckoutField label="Low-stock alert level" value={low} onChangeText={setLow} keyboardType="number-pad" editable={!busy} /><Toggle label="Available for sale" value={available} onChange={setAvailable} disabled={busy} /><Button title="Save inventory" disabled={busy || !valid} onPress={() => save(item.id, { price, stock: Number(stock), low_stock: Number(low), available, version })} /><Button title="Cancel" secondary disabled={busy} onPress={close} /></Card>;
}

function PrescriptionDecision({ item, medicines, busy, decide, close }: { item: PharmacyPrescription; medicines: PharmacyMedicine[]; busy: boolean; decide: (status: string, note: string, approved: { medicineId: string; quantity: number }[]) => void; close: () => void }) {
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState('approved');
  const [confirm, setConfirm] = useState(false);
  const approves = ['approved', 'partially_approved'].includes(outcome);
  const lines = Object.entries(quantities).filter(([, value]) => /^\d+$/.test(value) && Number(value) > 0).map(([medicineId, value]) => ({ medicineId, quantity: Number(value) }));
  return <Card><Text style={s.heading}>{item.reference}</Text><Text style={s.muted}>{item.customer}</Text><PrivateDocument name={item.file_name} load={() => api.pharmacyPrescriptionFile(item.id)} title="Inspect prescription file" /><Text style={s.muted}>Identify each medicine and quantity from the file. Customer selections are requests, not verified readings.</Text>{item.requested.map(line => <Text key={line.medicineId} style={s.caption}>Requested: {medicines.find(m => m.catalog_id === line.medicineId)?.name || line.medicineId} - {line.quantity}</Text>)}<View style={s.row}>{['approved', 'partially_approved', 'needs_clearer_photo', 'rejected'].map(value => <Button key={value} title={stateLabel(value)} secondary={outcome !== value} disabled={busy || confirm} onPress={() => setOutcome(value)} />)}</View>{approves && medicines.filter(m => m.status === 'Approved' && m.inventory?.available).map(m => <CheckoutField key={m.id} label={`${m.name} - ${m.strength} ${m.form} (${m.unit})`} value={quantities[m.catalog_id] || ''} onChangeText={value => setQuantities(prev => ({ ...prev, [m.catalog_id]: value }))} keyboardType="number-pad" placeholder="Approved quantity, or leave blank" maxLength={3} editable={!busy && !confirm} />)}<CheckoutField label="Review notes" multiline value={note} onChangeText={setNote} maxLength={1000} editable={!busy && !confirm} style={{ minHeight: 100 }} />{confirm ? <><Text style={s.text}>Confirm this pharmacist decision? It will be saved to the review history.</Text><Button title="Confirm decision" disabled={busy} onPress={() => decide(outcome, note, approves ? lines : [])} /><Button title="Edit decision" secondary disabled={busy} onPress={() => setConfirm(false)} /></> : <Button title="Review decision" disabled={busy || (approves && !lines.length) || (outcome !== 'approved' && !note.trim())} onPress={() => setConfirm(true)} />}<Button title="Close" secondary disabled={busy} onPress={close} /></Card>;
}

function BranchProfile({ app, busy, save }: { app: PharmacyApplication; busy: boolean; save: (data: Record<string, unknown>) => void }) {
  const details = usePharmacyBranchDetails(app);
  const [attempted, setAttempted] = useState(false);
  const issue = details.contactIssue() || details.hoursIssue;
  return <Card><Text style={s.heading}>Branch contact and hours</Text><PharmacyBranchDetailsFields details={details} disabled={busy} attempted={attempted} />{attempted && !!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}<Button title="Save profile" disabled={busy} onPress={() => { setAttempted(true); if (!issue) save(details.payload); }} /></Card>;
}

export function PharmacyPortal() {
  const { profile, signOut, refreshProfile } = useProfile();
  const { tab: routeTab } = useLocalSearchParams<{ tab?: string }>();
  const tab: Tab = ['inventory', 'prescriptions', 'orders', 'profile'].includes(routeTab || '') ? routeTab as Tab : 'dashboard';
  const [session, setSession] = useState<PharmacySession | null>(null);
  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([]);
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [orders, setOrders] = useState<PharmacyOrderRecord[]>([]);
  const [activity, setActivity] = useState<PharmacyActivity[]>([]);
  const [team, setTeam] = useState<Awaited<ReturnType<typeof api.pharmacyTeam>>>([]);
  const [riders, setRiders] = useState<{ id: number; name: string; vehicle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [requesting, setRequesting] = useState(false);
  const [medicineEdit, setMedicineEdit] = useState<PharmacyMedicine | null>(null);
  const [inventoryEdit, setInventoryEdit] = useState<PharmacyMedicine | null>(null);
  const [rxEdit, setRxEdit] = useState<PharmacyPrescription | null>(null);
  const [orderEditId, setOrderEditId] = useState<number | null>(null);
  const orderEdit = orders.find(order => order.id === orderEditId) || null;
  const [orderNote, setOrderNote] = useState('');
  const [confirmAction, setConfirmAction] = useState('');
  const [rider, setRider] = useState<number | null>(null);
  const account = useRef(profile?.email);
  account.current = profile?.email;
  const refresh = useCallback(async () => {
    const email = account.current;
    const current = await api.pharmacyMe();
    if (account.current !== email) return;
    setSession(current);
    await refreshProfile();
    if (current.application?.status === 'Approved') {
      const [m, p, o, r, a, t] = await Promise.all([api.pharmacyMedicines(), api.pharmacyPrescriptions(), api.pharmacyOrders(), api.pharmacyRiders(), api.pharmacyActivity(), api.pharmacyTeam()]);
      if (account.current !== email) return;
      setMedicines(m); setPrescriptions(p); setOrders(o); setRiders(r); setActivity(a); setTeam(t);
    }
  }, [refreshProfile]);
  useEffect(() => { let live = true; setLoading(true); setSession(null); setMedicines([]); setOrders([]); setPrescriptions([]); setActivity([]); setError(''); refresh().catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); }); const timer = setInterval(() => { if (live) refresh().catch(() => undefined); }, 20000); return () => { live = false; clearInterval(timer); }; }, [refresh, profile?.email]);
  useEffect(() => { setQuery(''); setFilter('All'); setRequesting(false); setMedicineEdit(null); setInventoryEdit(null); setRxEdit(null); setOrderEditId(null); setConfirmAction(''); }, [tab]);
  async function act(action: () => Promise<unknown>, message: string, done?: () => void) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); done?.(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'The action could not be saved.'); if (e instanceof ApiError && e.status === 409) { setInventoryEdit(null); setRxEdit(null); setOrderEditId(null); setConfirmAction(''); await refresh().catch(() => undefined); } }
    finally { setBusy(false); }
  }
  const app = session?.application;
  const approved = app?.status === 'Approved';
  const editable = !app || ['Draft', 'Needs Info', 'Rejected'].includes(app.status);
  useEffect(() => { if (!loading && session && !approved && !['dashboard', 'profile'].includes(tab)) router.setParams({ tab: 'dashboard' }); }, [loading, session, approved, tab]);
  const move = (value: Tab) => router.setParams({ tab: value });
  const pendingOrders = orders.filter(o => o.data.status === 'awaiting_confirmation');
  const pendingRx = prescriptions.filter(p => p.status === 'pending');
  const outOfStock = medicines.filter(m => m.status === 'Approved' && (!m.inventory || m.inventory.stock - m.inventory.reserved === 0));
  const lowStock = medicines.filter(m => m.inventory && m.inventory.available && m.inventory.stock - m.inventory.reserved <= m.inventory.low_stock);
  const visibleMedicines = medicines.filter(m => `${m.name} ${m.generic} ${m.strength}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || (filter === 'Low stock' ? lowStock.includes(m) : filter === 'Out of stock' ? outOfStock.includes(m) : m.status === filter)));
  const visibleOrders = orders.filter(o => `${o.data.id} ${o.data.recipient.name}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || (filter === 'Current' ? !finished(o.data.status) : finished(o.data.status))));
  return <Page scrollKey={`pharmacy-${tab}`}><View style={s.between}><Text accessibilityRole="header" style={s.title}>{!approved && tab !== 'profile' ? 'Pharmacy application' : stateLabel(tab)}</Text><TextLink title="Refresh" icon="clock" onPress={() => void act(refresh, 'Records refreshed.')} /></View>{loading && <ActivityIndicator accessibilityLabel="Loading pharmacy records" color={colors.teal} />}{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}{!!notice && <Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
    {!loading && session && !approved && tab !== 'profile' && <>
      <Button title={profile?.isStaff ? 'Back to administration' : 'Back to home'} secondary icon="back" onPress={() => router.replace(accountHome(profile))} />
      {app && <Card><View style={s.between}><Text style={s.heading}>{app.name}</Text><Status value={app.status} /></View>{!!app.notes && <Text style={s.text}>{app.notes}</Text>}{app.status === 'Pending' && <Text style={s.muted}>Your application is with admin for review.</Text>}{app.history.map(event => <View key={event.id} style={{ gap: 4 }}><Text style={s.muted}>{stateLabel(event.status)} - {new Date(event.created_at).toLocaleDateString()}</Text>{!!event.notes && <Text style={s.caption}>{event.notes}</Text>}</View>)}</Card>}
      <PharmacyApplicationForm key={profile?.email} app={app || null} editable={editable} onSaved={application => setSession(previous => ({ application, role: previous?.role || 'owner', can_review: false }))} />
      <Text style={s.muted}>Approval is required before inventory, prescription review, and orders become available.</Text>
    </>}
    {!loading && approved && tab === 'dashboard' && <>
      <Card><View style={s.between}><View style={{ flex: 1 }}><Text style={s.heading}>{app.name}</Text><Text style={s.muted}>{app.address}</Text></View><Status value={app.is_open ? 'Open' : 'Closed'} /></View><Toggle label="Accept orders" value={app.is_open} disabled={busy || session?.role === 'staff'} onChange={value => void act(() => api.pharmacySetOpen(value), value ? 'Pharmacy opened.' : 'Pharmacy closed.')} /></Card>
      <View style={s.row}>{[{ title: 'New orders', count: pendingOrders.length, tab: 'orders' }, { title: 'Prescription reviews', count: pendingRx.length, tab: 'prescriptions' }, { title: 'Low stock', count: lowStock.length, tab: 'inventory' }, { title: 'Out of stock', count: outOfStock.length, tab: 'inventory' }].map(item => <Pressable key={item.title} accessibilityRole="link" onPress={() => move(item.tab as Tab)} style={[s.card, { flexGrow: 1, minWidth: 130 }]}><Text style={s.title}>{item.count}</Text><Text style={s.muted}>{item.title}</Text></Pressable>)}</View>
      <Card><Text style={s.heading}>Activity</Text>{activity.length ? activity.slice(0, 10).map(event => <View key={event.id} style={{ gap: 4 }}><Text style={s.text}>{event.action}</Text><Text style={s.caption}>{event.actor} - {new Date(event.created_at).toLocaleString()}</Text>{!!event.note && <Text style={s.muted}>{event.note}</Text>}</View>) : <Text style={s.muted}>No activity yet.</Text>}</Card>
    </>}
    {!loading && approved && tab === 'inventory' && <>
      {requesting ? <MedicineForm initial={medicineEdit} busy={busy} close={() => setRequesting(false)} save={data => void act(() => api.pharmacyMedicineRequest(data), 'Medicine request submitted.', () => { setRequesting(false); setMedicineEdit(null); })} /> : inventoryEdit ? <InventoryForm key={inventoryEdit.id} item={inventoryEdit} busy={busy} close={() => setInventoryEdit(null)} save={(id, data) => void act(() => api.pharmacyInventory(id, data), 'Inventory saved.', () => setInventoryEdit(null))} /> : <>
        <Button title="Request medicine" icon="plus" onPress={() => { setMedicineEdit(null); setRequesting(true); }} /><CheckoutField label="Search inventory" value={query} onChangeText={setQuery} /><View style={s.row}>{['All', 'Approved', 'Pending', 'Rejected', 'Low stock', 'Out of stock'].map(value => <Button key={value} title={value} secondary={filter !== value} onPress={() => setFilter(value)} />)}</View>
        {visibleMedicines.map(m => <Card key={m.id}><View style={s.between}><Text style={[s.heading, { flexShrink: 1 }]}>{m.name}</Text><Status value={m.status} /></View><Text style={s.muted}>{m.strength} - {m.form}</Text><Badge text={m.prescription ? 'Prescription' : 'OTC'} neutral={!m.prescription} />{m.status === 'Approved' ? <><DetailRow label="Available / reserved" value={`${(m.inventory?.stock ?? 0) - (m.inventory?.reserved ?? 0)} / ${m.inventory?.reserved ?? 0}`} /><DetailRow label="Price" value={m.inventory ? money(Number(m.inventory.price)) : 'Not set'} /><Button title="Set stock and price" secondary onPress={() => setInventoryEdit(m)} /></> : <>{!!m.notes && <Text style={s.text}>{m.notes}</Text>}<Button title={m.status === 'Rejected' ? 'Update and resubmit' : 'Edit request'} secondary onPress={() => { setMedicineEdit(m); setRequesting(true); }} /></>}</Card>)}{!visibleMedicines.length && <Card><Text style={s.muted}>No medicines match this filter.</Text></Card>}
      </>}
    </>}
    {!loading && approved && tab === 'prescriptions' && <>
      {!session?.can_review && <Card><Text style={s.muted}>Only verified pharmacists can open prescription files and record clinical decisions. Admin must verify your membership credentials.</Text></Card>}
      {rxEdit && session?.can_review ? <PrescriptionDecision key={rxEdit.id} item={rxEdit} medicines={medicines} busy={busy} close={() => setRxEdit(null)} decide={(status, note, lines) => void act(() => api.pharmacyPrescriptionReview(rxEdit.id, { version: rxEdit.version, status, note, approved: lines }), 'Prescription decision saved.', () => setRxEdit(null))} /> : prescriptions.map(rx => <Card key={rx.id}><View style={s.between}><Text style={s.heading}>{rx.reference}</Text><Status value={rx.status} /></View><Text style={s.muted}>{rx.customer}</Text>{rx.status === 'pending' && session?.can_review && <Button title="Review prescription" secondary onPress={() => setRxEdit(rx)} />}{rx.status !== 'pending' && <><Text style={s.text}>{rx.note}</Text><Text style={s.caption}>{rx.reviewer}{rx.reviewed_at ? ` - ${new Date(rx.reviewed_at).toLocaleString()}` : ''}</Text></>}</Card>)}{!prescriptions.length && <Card><Text style={s.muted}>No prescriptions assigned to this pharmacy.</Text></Card>}
    </>}
    {!loading && approved && tab === 'orders' && <>
      {orderEdit ? <>
        <Back title={orderEdit.data.id} onBack={() => { setOrderEditId(null); setConfirmAction(''); }} /><Card><View style={s.between}><Text style={s.heading}>{orderEdit.data.recipient.name}</Text><Status value={orderEdit.data.status} /></View><Text style={s.muted}>{orderEdit.data.recipient.phone}</Text>{orderEdit.data.lines.map(line => <View key={line.medicine.id} style={{ gap: 4 }}><Text style={s.text}>{line.medicine.name} - {line.medicine.strength} {line.medicine.form}</Text><Text style={s.muted}>{line.quantity} {line.medicine.unit} - {money(line.subtotal)}</Text>{line.approval && <Badge text={`Rx ${line.approval.prescriptionId}`} />}</View>)}<DetailRow label="Total" value={money(orderEdit.data.total)} /><DetailRow label="Payment" value={orderEdit.data.payment} /><DetailRow label="Fulfillment" value={stateLabel(orderEdit.data.method)} />{orderEdit.data.address && <><Text style={s.text}>{Object.values(orderEdit.data.address).filter(Boolean).join(', ')}</Text><DestinationMap address={Object.values(orderEdit.data.address).filter(Boolean).join(', ')} barangay={orderEdit.data.address.barangay} city={orderEdit.data.address.city} /></>}</Card>
        {!finished(orderEdit.data.status) && <Card><CheckoutField label="Order notes / rejection reason" value={orderNote} onChangeText={setOrderNote} maxLength={1000} multiline />{confirmAction ? <><Text style={s.text}>Confirm: {stateLabel(confirmAction)}?</Text><Button title="Confirm update" disabled={busy} onPress={() => void act(() => api.pharmacyOrderAction(orderEdit.id, { version: orderEdit.version, status: confirmAction, note: orderNote }), 'Order updated.', () => { setOrderEditId(null); setConfirmAction(''); })} /><Button title="Cancel" secondary disabled={busy} onPress={() => setConfirmAction('')} /></> : ({ awaiting_confirmation: ['confirmed', 'rejected'], confirmed: ['preparing'], preparing: [orderEdit.data.method === 'pickup' ? 'ready_for_pickup' : 'ready_for_collection'], ready_for_pickup: ['collected'] } as Record<string, string[]>)[orderEdit.data.status]?.map(status => <Button key={status} title={{ confirmed: 'Accept and reserve stock', rejected: 'Reject order', preparing: 'Start preparing', ready_for_pickup: 'Ready for pickup', ready_for_collection: 'Ready for rider collection', collected: 'Confirm customer collection' }[status] || stateLabel(status)} secondary={status === 'rejected'} disabled={busy || (status === 'rejected' && !orderNote.trim())} onPress={() => setConfirmAction(status)} />)}</Card>}
        {orderEdit.data.status === ('ready_for_collection' as OrderStatus) && (!orderEdit.rider || ['declined', 'cancelled'].includes(orderEdit.rider.status)) && <Card><Text style={s.heading}>Assign rider</Text>{riders.map(r => <Button key={r.id} title={`${r.name} - ${r.vehicle}`} secondary={rider !== r.id} disabled={busy} onPress={() => setRider(r.id)} />)}{!riders.length && <Text style={s.muted}>No approved riders are available. Keep the package ready and refresh later.</Text>}<Button title="Send collection offer" disabled={busy || rider === null} onPress={() => rider !== null && void act(() => api.pharmacyHandoff(orderEdit.id, orderEdit.version, rider), 'Rider offer sent.', () => setOrderEditId(null))} /></Card>}
        {orderEdit.rider && <Card><Text style={s.heading}>Rider handoff</Text><Text style={s.text}>{orderEdit.rider.name}</Text><Status value={orderEdit.rider.status} /></Card>}
      </> : <><CheckoutField label="Search orders" value={query} onChangeText={setQuery} /><View style={s.row}>{['All', 'Current', 'Closed'].map(value => <Button key={value} title={value} secondary={filter !== value} onPress={() => setFilter(value)} />)}</View>{visibleOrders.map(o => <Card key={o.id}><View style={s.between}><Text style={s.heading}>{o.data.id}</Text><Status value={o.data.status} /></View><Text style={s.muted}>{o.data.recipient.name} - {stateLabel(o.data.method)}</Text><Text style={s.price}>{money(o.data.total)}</Text><Button title="Open order" secondary onPress={() => { setOrderEditId(o.id); setOrderNote(''); setRider(null); }} /></Card>)}{!visibleOrders.length && <Card><Text style={s.muted}>No orders match this filter.</Text></Card>}</>}
    </>}
    {tab === 'profile' && <>
      {approved && <><Card><Text style={s.heading}>{app.name}</Text><Text style={s.muted}>{app.address}</Text><Badge text={`${stateLabel(session?.role || 'staff')}${session?.can_review ? ' - Verified pharmacist' : ''}`} /><Text style={s.muted}>{profile?.email}</Text></Card>{session?.role === 'owner' && <BranchProfile app={app} busy={busy} save={data => void act(() => api.pharmacyApplication(data, true), 'Profile saved.')} />}<DestinationMap address={app.address} verifiedPoint={app.point} /><Card><Text style={s.heading}>Linked staff</Text>{team.map(member => <View key={member.id} style={{ gap: 4 }}><Text style={s.text}>{member.name || member.email}</Text><Text style={s.caption}>{stateLabel(member.role)}{member.verified_pharmacist ? " - Verified pharmacist" : ""}{member.active ? "" : " - Inactive"}</Text></View>)}<Text style={s.caption}>Admin verifies pharmacist credentials and manages staff permissions.</Text></Card></>}
      {approved && session?.role === 'owner' && <PharmacyTeamInvitations />}<Card><Button title={profile?.isStaff ? 'Back to administration' : 'Customer home'} secondary onPress={() => router.replace(profile?.isStaff ? '/admin' : '/home')} /><Button title="Sign out" secondary disabled={busy} onPress={async () => { await signOut(); router.replace('/'); }} /></Card><ProfileLinks />
    </>}
  </Page>;
}
