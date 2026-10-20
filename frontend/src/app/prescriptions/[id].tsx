import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { View, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { useCart } from '../../state/cart';
import { useOrders } from '../../state/orders';
import { addItem } from '../../domain/cart';
import { pharmacyEstimate, prescriptionLabels, type Prescription, type PrescriptionFile, type RequestLine } from '../../domain/prescriptions';
import { medicines, pharmacies, offers, money } from '../../data/catalog';
import { Page, Back, Card, Badge, Button, Quantity, TextLink, Text, colors, s } from '../../components/ui';
import { FilePreview, PrescriptionPicker } from '../../components/prescription-file';
import { CheckoutField } from '../../components/checkout-field';

function Draft({ record }: { record: Prescription }) {
  const { edit, submit } = usePrescriptions();
  const [error, setError] = useState('');
  const change = (requested: RequestLine[], pharmacyId = record.pharmacyId) => { edit(record.id, requested, pharmacyId); setError(''); };
  return <>
    <Card><Text style={s.heading}>Sample request items</Text><Text style={s.muted}>For testing the flow, manually choose sample catalog items. These are not read from your file and are not treatment recommendations. A real pharmacist must identify and verify the medicines.</Text>
      {medicines.map(m => {
        const line = record.requested.find(l => l.medicineId === m.id);
        return <View key={m.id} style={{ gap: 10, borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 }}><Pressable accessibilityRole="checkbox" accessibilityLabel={`Request ${m.name} ${m.form}`} accessibilityState={{ checked: !!line }} aria-checked={!!line} onPress={() => change(line ? record.requested.filter(l => l !== line) : [...record.requested, { medicineId: m.id, quantity: 1 }])} style={{ minHeight: 44, flexDirection: 'row', gap: 10, alignItems: 'center' }}><View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: colors.teal, backgroundColor: line ? colors.teal : colors.white }} /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontWeight: '600' }}>{m.name}</Text><Text style={s.muted}>{m.strength} · {m.form}</Text></View></Pressable>{line && <View style={s.between}><Text style={s.muted}>Requested {m.unit}s</Text><Quantity value={line.quantity} max={100} onChange={quantity => change(record.requested.map(l => l === line ? { ...l, quantity } : l))} /></View>}</View>;
      })}
    </Card>
    <View style={{ gap: 12 }}><Text style={s.heading}>Choose a pharmacy</Text><Text style={s.muted}>Sample stock and estimated available-item totals. Final quantities depend on the simulated review. Fees are added at checkout.</Text>
      {pharmacies.map(p => {
        const estimate = pharmacyEstimate(record.requested, p.id);
        const selected = p.id === record.pharmacyId;
        return <View key={p.id} style={[s.card, { borderColor: selected ? colors.teal : colors.line, borderWidth: 2 }]}><Pressable accessibilityRole="radio" accessibilityLabel={p.name} accessibilityState={{ checked: selected, disabled: !estimate.any }} aria-checked={selected} disabled={!estimate.any} onPress={() => change(record.requested, p.id)} style={{ gap: 8, minHeight: 44 }}><View style={s.between}><Text style={s.heading}>{p.name}</Text><Badge text={selected ? 'Selected' : !record.requested.length ? 'Choose items first' : estimate.all ? 'All items available' : estimate.any ? 'Partially available' : 'Unavailable'} neutral={!estimate.any} warning={estimate.any && !estimate.all} /></View><Text style={s.muted}>{p.address}</Text></Pressable>
          {estimate.rows.map(row => { const m = medicines.find(m => m.id === row.medicineId)!; return <View key={m.id} style={{ gap: 4 }}><Text style={s.text}>{m.name} · {m.strength}</Text><Text style={s.muted}>{row.available} / {row.quantity} {m.unit}s available{row.unitPrice !== null ? ` · ${money(row.unitPrice)} / ${m.unit}` : ' · Not listed'}</Text></View>; })}
          {!!record.requested.length && <Text style={s.price}>Estimated items: {money(estimate.total)}</Text>}
        </View>;
      })}
    </View>
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    <Button title="Submit for demo review" icon="prescription" disabled={!record.requested.length || !record.pharmacyId} onPress={() => { const result = submit(record.id, record.requested, record.pharmacyId); if (!result.ok) setError(result.issue); }} />
  </>;
}

function ReviewControls({ record }: { record: Prescription }) {
  const { review } = usePrescriptions();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const initial = pharmacyEstimate(record.requested, record.pharmacyId).rows.filter(l => l.available > 0).map(l => ({ medicineId: l.medicineId, quantity: l.available }));
  const [lines, setLines] = useState<RequestLine[]>(initial);
  const complete = lines.length === record.requested.length && record.requested.every(r => lines.some(l => l.medicineId === r.medicineId && l.quantity === r.quantity));
  function outcome(status: 'approved' | 'partially_approved' | 'rejected' | 'needs_clearer_photo') { const result = review(record.id, status, lines, note); if (!result.ok) setError(result.issue); }
  return <Card><Text style={s.heading}>Awaiting simulated review</Text><Text style={s.muted}>Your file is saved to your account. The {pharmacies.find(p => p.id === record.pharmacyId)?.name} review shown here is only a local simulation.</Text>
    <Button title={open ? 'Hide preview review controls' : 'Preview pharmacist review controls'} secondary onPress={() => setOpen(!open)} />
    {open && <><Text style={s.caption}>Simulation controls · You are testing outcomes, not granting medical approval. Choose which requested quantities the demo review accepts.</Text>
      {record.requested.map(r => { const m = medicines.find(m => m.id === r.medicineId)!; const line = lines.find(l => l.medicineId === r.medicineId); const max = initial.find(l => l.medicineId === r.medicineId)?.quantity ?? 0; return <View key={m.id} style={{ gap: 10 }}><Pressable accessibilityRole="checkbox" accessibilityLabel={`Approve ${m.name} ${m.form}`} accessibilityState={{ checked: !!line, disabled: !max }} aria-checked={!!line} disabled={!max} onPress={() => setLines(line ? lines.filter(l => l !== line) : [...lines, { medicineId: m.id, quantity: max }])} style={{ minHeight: 44, gap: 4 }}><Text style={{ fontWeight: '600', color: line ? colors.teal : colors.muted }}>{line ? '✓ ' : '○ '}{m.name} · {m.strength}</Text><Text style={s.muted}>{max ? `Up to ${max} ${m.unit}s available` : 'Not available at this pharmacy'}</Text></Pressable>{line && <Quantity value={line.quantity} max={max} onChange={quantity => setLines(lines.map(l => l === line ? { ...l, quantity } : l))} />}</View>; })}
      <CheckoutField label="Review reason" value={note} onChangeText={setNote} placeholder="Required for partial approval, rejection, or a clearer photo" multiline maxLength={500} />
      <Button title={complete ? 'Simulate approval' : 'Simulate partial approval'} disabled={!lines.length} onPress={() => outcome(complete ? 'approved' : 'partially_approved')} />
      <Button title="Simulate clearer photo needed" secondary onPress={() => outcome('needs_clearer_photo')} /><Button title="Simulate rejection" secondary onPress={() => outcome('rejected')} />
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    </>}
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
  return <Card><Text style={s.heading}>Review approved items</Text><Text style={s.muted}>Select the items and quantities for your cart. Only the simulated approved quantities at this pharmacy can be ordered. An approval is consumed when a demo order is created, including orders later cancelled.</Text>
    {record.requested.map(request => {
      const m = medicines.find(m => m.id === request.medicineId)!;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, replace, loading, syncIssue } = usePrescriptions();
  const record = records.find(r => r.id === id);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [record?.status, record?.revision]);
  const wide = useWindowDimensions().width >= 900;
  const [replacement, setReplacement] = useState<PrescriptionFile | null>(null);
  const [error, setError] = useState('');
  if (!record) return <Page><Back title="Prescription details" />{loading ? <Text style={s.muted}>Loading saved prescription…</Text> : <><Text style={s.muted}>This prescription is not available in your account.</Text><Button title="Prescription history" onPress={() => router.replace('/prescriptions')} /></>}</Page>;
  function replaceFile(file: PrescriptionFile) { const result = replace(id, file); if (!result.ok) setError(result.issue); setReplacement(null); }
  return <Page scrollRef={scrollRef}><Back title={record.status === 'draft' ? 'Review your prescription file' : 'Prescription details'} onBack={() => router.navigate('/prescriptions')} /><View style={s.between}><Text style={s.heading}>{record.id} · Version {record.revision}</Text><Badge text={prescriptionLabels[record.status]} warning={record.status === 'pending' || record.status === 'needs_clearer_photo'} neutral={record.status === 'draft' || record.status === 'rejected'} /></View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}><View style={{ width: wide ? 340 : '100%', gap: 16 }}><Card><FilePreview key={record.file.uri} file={record.file} />{record.status !== 'pending' && <PrescriptionPicker replacement onPick={file => record.approved.length ? setReplacement(file) : replaceFile(file)} />}</Card>{!!syncIssue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{syncIssue}</Text>}<Text style={s.caption}>The file is stored privately when signed in. No real pharmacy or pharmacist receives it from this preview.</Text></View>
    <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
      {record.status !== 'draft' && <Card><Text style={s.heading}>{pharmacies.find(p => p.id === record.pharmacyId)?.name}</Text><Text style={s.muted}>Selected for this prescription review</Text>{record.requested.map(l => {
        const m = medicines.find(m => m.id === l.medicineId)!;
        return <View key={m.id} style={{ gap: 3 }}><Text style={s.text}>{m.name} · {m.strength}</Text><Text style={s.muted}>{l.quantity} {m.unit}{l.quantity === 1 ? '' : 's'} requested · {m.form}</Text></View>;
      })}{!!record.note && <Text style={s.text}>Review reason: {record.note}</Text>}{record.status === 'rejected' && <Text style={s.muted}>No items approved. Replace the file to start another demo review.</Text>}{record.status === 'needs_clearer_photo' && <Text style={s.muted}>Replace the file with a clearer image, inspect the preview, and submit again.</Text>}</Card>}
      {record.status === 'draft' && <Draft key={`${record.id}-${record.revision}`} record={record} />}
      {record.status === 'pending' && <ReviewControls key={`${record.id}-${record.revision}`} record={record} />}
      {(record.status === 'approved' || record.status === 'partially_approved') && <ApprovedItems key={`${record.id}-${record.revision}`} record={record} />}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
      <TextLink title="Prescription history" onPress={() => router.navigate('/prescriptions')} />
    </View></View>
    <Modal transparent visible={!!replacement} animationType="none" onRequestClose={() => setReplacement(null)}><View style={{ flex: 1, backgroundColor: '#162A2480', justifyContent: 'center', padding: 24 }}><Card><Text style={s.heading}>Replace approved file?</Text><Text style={s.text}>This starts a new draft and invalidates the previous approval. Any linked cart items will need review again. Existing demo order records keep their original snapshot.</Text><Button title="Keep approved file" secondary onPress={() => setReplacement(null)} /><Button title="Replace and restart review" onPress={() => replacement && replaceFile(replacement)} /></Card></View></Modal>
  </Page>;
}
