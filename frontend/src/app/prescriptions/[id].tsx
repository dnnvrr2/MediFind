import { PrivateDocument } from '../../components/private-document';
import { api } from '../../api/client';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { View, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { useCart } from '../../state/cart';
import { useOrders } from '../../state/orders';
import { addItem } from '../../domain/cart';
import { prescriptionLabel, type Prescription, type PrescriptionFile } from '../../domain/prescriptions';
import { useCatalog, medicines, pharmacies, offers, money } from '../../data/catalog';
import { Page, Back, Card, Badge, Button, Quantity, TextLink, Text, colors, s } from '../../components/ui';
import { FilePreview, PrescriptionPicker } from '../../components/prescription-file';

function Draft({ record }: { record: Prescription }) {
  const { edit, submit } = usePrescriptions();
  const [error, setError] = useState('');
  const selected = pharmacies.find(pharmacy => pharmacy.id === record.pharmacyId);
  return <Card>
    <Text style={s.heading}>Send to a pharmacy</Text>
    {pharmacies.length ? pharmacies.map(pharmacy =>
      <Button key={pharmacy.id} title={pharmacy.name + (pharmacy.isOpen ? '' : ' - Closed')}
        secondary={record.pharmacyId !== pharmacy.id} disabled={!pharmacy.isOpen}
        onPress={() => { edit(record.id, [], pharmacy.id); setError(''); }} />
    ) : <Text style={s.muted}>No pharmacies are accepting prescriptions.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    <Button title="Submit to pharmacist" icon="prescription" disabled={!selected?.isOpen} onPress={() => {
      const result = submit(record.id, [], record.pharmacyId);
      if (!result.ok) setError(result.issue);
    }} />
  </Card>;
}

function ApprovedItems({ record }: { record: Prescription }) {
  const { approvals } = useOrders();
  const { items, setItems } = useCart();
  const [selection, setSelection] = useState(record.approved.map(l => ({ ...l })));
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const grants = approvals.filter(g => g.prescriptionId === record.id && g.revision === record.revision);
  function add(confirm = false) {
    let next = items;
    const selected = selection.map(l => ({ ...l, quantity: Math.min(l.quantity, Math.max(0, (grants.find(g => g.medicineId === l.medicineId)?.quantity ?? 0) - (items.find(i => i.medicineId === l.medicineId && i.prescriptionId === record.id && i.revision === record.revision)?.quantity ?? 0))) })).filter(l => l.quantity > 0);
    if (!selected.length) { setError('Select at least one approved item.'); return; }
    for (const line of selected) {
      const result = addItem(next, line.medicineId, record.pharmacyId, line.quantity, confirm, approvals, record.id, record.revision);
      if (result.kind === 'replace') { setReplace(true); return; }
      if (result.kind !== 'added') { setError('Check approved quantities and items already in your cart. Remove an existing copy from another prescription before adding this one.'); setReplace(false); return; }
      next = result.items;
    }
    setItems(next); setReplace(false); router.push('/cart');
  }
  return <Card><Text style={s.heading}>Review approved items</Text><Text style={s.muted}>Choose approved quantities for your cart. Creating an order consumes this approval, even if cancelled.</Text>
    {record.approved.map(request => {
      const m = medicines.find(m => m.id === request.medicineId);
      if (!m) return <View key={request.medicineId} style={{ gap: 8 }}><Text style={s.muted}>An approved medicine is currently unavailable in the catalog. Refresh the catalog or contact the pharmacy.</Text></View>;
      const approved = record.approved.find(l => l.medicineId === m.id)?.quantity ?? 0;
      const remaining = grants.find(g => g.medicineId === m.id)?.quantity ?? 0;
      const inCart = items.find(i => i.medicineId === m.id && i.prescriptionId === record.id && i.revision === record.revision)?.quantity ?? 0;
      const max = Math.max(0, remaining - inCart);
      const line = selection.find(l => l.medicineId === m.id);
      const price = offers.find(o => o.medicineId === m.id && o.pharmacyId === record.pharmacyId)?.price;
      return <View key={m.id} style={{ gap: 8, borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }}><Text style={{ fontWeight: '600' }}>{m.name}</Text><Text style={s.muted}>{m.strength} · {m.form}</Text>{price !== undefined && <Text style={s.muted}>{money(price)} / {m.unit}</Text>}<Text style={s.muted}>{approved} / {request.quantity} {m.unit}s approved · {max} left to add</Text>
        {max > 0 && <><Pressable accessibilityRole="checkbox" accessibilityLabel={`Add approved ${m.name} ${m.form}`} accessibilityState={{ checked: !!line }} aria-checked={!!line} onPress={() => setSelection(line ? selection.filter(l => l !== line) : [...selection, { medicineId: m.id, quantity: max }])} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>{line ? '✓ Selected for cart' : 'Select for cart'}</Text></Pressable>{line && <Quantity value={Math.min(line.quantity, max)} max={max} onChange={quantity => setSelection(selection.map(l => l === line ? { ...l, quantity } : l))} />}</>}
      </View>;
    })}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    <Text style={s.price}>Selected items: {money(selection.reduce((total, l) => {
      const remaining = Math.max(0, (grants.find(g => g.medicineId === l.medicineId)?.quantity ?? 0) - (items.find(i => i.medicineId === l.medicineId && i.prescriptionId === record.id && i.revision === record.revision)?.quantity ?? 0));
      const price = offers.find(o => o.medicineId === l.medicineId && o.pharmacyId === record.pharmacyId)?.price ?? 0;
      return total + Math.min(l.quantity, remaining) * price;
    }, 0))}</Text>
    <Button title="Add selected approved items" icon="cart" disabled={!selection.some(l => grants.some(g => g.medicineId === l.medicineId && g.quantity > (items.find(i => i.medicineId === l.medicineId && i.prescriptionId === record.id && i.revision === record.revision)?.quantity ?? 0)))} onPress={() => add()} />
    <Modal transparent visible={replace} animationType="none" onRequestClose={() => setReplace(false)}><View style={{ flex: 1, backgroundColor: '#162A2480', justifyContent: 'center', padding: 24 }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', maxWidth: 440, width: '100%', alignSelf: 'center' }}><Card><Text style={s.heading}>Switch pharmacy?</Text><Text style={s.text}>Your current cart is for another pharmacy. Replace it with these approved items from {pharmacies.find(p => p.id === record.pharmacyId)?.name}?</Text><Button title="Keep current cart" secondary onPress={() => setReplace(false)} /><Button title="Replace cart with approved items" onPress={() => add(true)} /></Card></ScrollView></View></Modal>
  </Card>;
}

export default function PrescriptionDetail() {
  useCatalog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, replace, loading, syncIssue, refresh, retrySync } = usePrescriptions();
  const record = records.find(r => r.id === id);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [record?.status, record?.revision]);
  const wide = useWindowDimensions().width >= 900;
  const [replacement, setReplacement] = useState<PrescriptionFile | null>(null);
  const [error, setError] = useState('');
  if (!record) return <Page><Back title="Prescription details" />{loading ? <Text style={s.muted}>Loading saved prescription…</Text> : <><Text style={s.muted}>This prescription is not available in your account.</Text><Button title="Prescription history" onPress={() => router.replace('/prescriptions')} /></>}</Page>;
  function replaceFile(file: PrescriptionFile) { const result = replace(id, file); if (!result.ok) setError(result.issue); setReplacement(null); }
  return <Page scrollRef={scrollRef}><Back title={record.status === 'draft' ? 'Review your prescription file' : 'Prescription details'} onBack={() => router.navigate('/prescriptions')} /><View style={s.between}><Text style={s.heading}>{record.id} · Version {record.revision}</Text><Badge text={prescriptionLabel(record)} warning={record.status === 'pending' || record.status === 'needs_clearer_photo'} neutral={record.status === 'draft' || record.status === 'rejected'} /></View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}><View style={{ width: wide ? 340 : '100%', gap: 16 }}><Card><FilePreview key={record.file.uri} file={record.file} />{record.file.uri.startsWith('remote:') && <PrivateDocument name={record.file.name} load={() => api.customerPrescriptionFile(record.file.uri.slice(7))} />}{record.status !== 'pending' && <PrescriptionPicker replacement onPick={file => record.approved.length ? setReplacement(file) : replaceFile(file)} />}</Card>{!!syncIssue && <><Text accessibilityRole="alert" style={{ color: colors.danger }}>{syncIssue}</Text><Button title="Retry sync" secondary onPress={() => void retrySync()} /></>}</View>
    <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
      {record.status !== 'draft' && <Card><Text style={s.heading}>{pharmacies.find(p => p.id === record.pharmacyId)?.name}</Text>{record.requested.map(l => {
        const m = medicines.find(m => m.id === l.medicineId);
        if (!m) return <Text key={l.medicineId} style={s.muted}>Requested medicine is currently unavailable.</Text>;
        return <View key={m.id} style={{ gap: 3 }}><Text style={s.text}>{m.name} · {m.strength}</Text><Text style={s.muted}>{l.quantity} {m.unit}{l.quantity === 1 ? '' : 's'} requested · {m.form}</Text></View>;
      })}{!!record.note && <Text style={s.text}>Review reason: {record.note}</Text>}{record.status === 'rejected' && <Text style={s.muted}>No items approved. Replace the file to start another review.</Text>}{record.status === 'needs_clearer_photo' && <Text style={s.muted}>Upload a clearer image and resubmit.</Text>}</Card>}
      {record.status === 'draft' && <Draft key={`${record.id}-${record.revision}`} record={record} />}
      {record.status === 'pending' && <Card><Button title="Refresh review" secondary onPress={() => void refresh()} /></Card>}
      {(record.status === 'approved' || record.status === 'partially_approved') && <ApprovedItems key={`${record.id}-${record.revision}`} record={record} />}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
      <TextLink title="Prescription history" onPress={() => router.navigate('/prescriptions')} />
    </View></View>
    <Modal transparent visible={!!replacement} animationType="none" onRequestClose={() => setReplacement(null)}><View style={{ flex: 1, backgroundColor: '#162A2480', justifyContent: 'center', padding: 24 }}><Card><Text style={s.heading}>Replace approved file?</Text><Text style={s.text}>Replacing the file invalidates its approval and linked cart items. Existing orders stay unchanged.</Text><Button title="Keep approved file" secondary onPress={() => setReplacement(null)} /><Button title="Replace and restart review" onPress={() => replacement && replaceFile(replacement)} /></Card></View></Modal>
  </Page>;
}
