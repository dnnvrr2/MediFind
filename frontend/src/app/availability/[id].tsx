import { useEffect, useState } from 'react';
import { Modal, Pressable, View, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { medicines, pharmacies, offers, money } from '../../data/catalog';
import { addItem } from '../../domain/cart';
import { useCart } from '../../state/cart';
import { Page, Back, Card, Badge, Button, Quantity, TextLink, Text, colors, s } from '../../components/ui';
import { Icon } from '../../components/icon';

export default function Availability() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = medicines.find(x => x.id === id);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [replace, setReplace] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setSelected(''); setQuantity(1); setReplace(false); setMessage(''); }, [id]);
  const { items, setItems } = useCart();
  const listings = offers.filter(o => o.medicineId === id);
  const offer = listings.find(o => o.pharmacyId === selected);
  const existing = items.find(i => i.medicineId === id && i.pharmacyId === selected)?.quantity ?? 0;
  const available = offer ? offer.stock - existing : 0;
  function add(confirm = false) {
    if (!m || !offer) return;
    const result = addItem(items, m.id, selected, quantity, confirm);
    if (result.kind === 'replace') return setReplace(true);
    if (result.kind === 'added') { setItems(result.items); setReplace(false); router.push('/cart'); }
    else { setMessage(result.kind === 'stock' ? 'The quantity exceeds available stock, including items already in your cart.' : 'This item cannot be added. Please check its availability.'); setReplace(false); }
  }
  if (!m) return <Page><Back title="Medicine not found" /></Page>;
  return <Page><Back title="Choose a pharmacy" />
    <View style={{ gap: 6 }}><Text style={s.heading}>{m.name}</Text><Text style={s.text}>{m.strength} · {m.form}</Text><Text style={s.muted}>Prices per {m.unit}. Stock shown is sample data, not live availability.</Text></View>
    {m.prescription && <Badge text="Prescription review required" warning />}
    <View style={{ gap: 12 }}>{listings.map(o => {
      const p = pharmacies.find(p => p.id === o.pharmacyId)!;
      const chosen = selected === p.id;
      return <View key={p.id} style={{ borderWidth: 2, borderColor: chosen ? colors.teal : colors.line, backgroundColor: colors.white, borderRadius: 10, padding: 16, gap: 4 }}>
        <Pressable accessibilityRole="radio" aria-checked={chosen} aria-disabled={!o.stock} accessibilityState={{ checked: chosen, disabled: !o.stock }} accessibilityLabel={`${p.name}, ${money(o.price)} per ${m.unit}, ${o.stock} available`} disabled={!o.stock} onPress={() => { setSelected(p.id); setQuantity(1); setMessage(''); }} style={{ gap: 12, minHeight: 88 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: chosen ? 0 : 1.5, borderColor: '#83958D', backgroundColor: chosen ? colors.teal : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{chosen && <Icon name="check" color={colors.white} size={16} />}</View><View style={{ flex: 1, gap: 5 }}><Text style={s.heading}>{p.name}</Text><Text style={s.muted}>{p.address}</Text></View></View>
          <View style={s.between}><Badge text={o.stock === 0 ? 'Out of stock' : o.stock <= 6 ? `Low stock · ${o.stock} ${m.unit}s` : `${o.stock} ${m.unit}s available`} warning={o.stock > 0 && o.stock <= 6} neutral={o.stock === 0} /><View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}><Text style={s.price}>{money(o.price)}</Text><Text style={s.muted}>/ {m.unit}</Text></View></View>
        </Pressable><TextLink title="View pharmacy details" icon="arrow-right" onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} />
      </View>;
    })}</View>
    {!listings.length && <View style={{ gap: 10 }}><Text style={s.heading}>No pharmacy listings yet</Text><Text style={s.muted}>Try another medicine from the sample catalog.</Text></View>}
    {m.prescription && <Card><Text style={s.heading}>Review before ordering</Text><Text style={s.muted}>Choose a prescription file and submit for simulated pharmacist review. Approved items are added through the prescription record.</Text><Button title="Upload prescription" icon="upload" onPress={() => router.push('/prescriptions/upload')} /></Card>}{!m.prescription && <Card><Text style={s.heading}>Your selection</Text>{offer ? <>
      <Text style={s.text}>{pharmacies.find(p => p.id === selected)?.name}</Text><Text style={s.muted}>{money(offer.price)} per {m.unit}{existing > 0 ? ` · ${existing} already in your cart` : ''}</Text>
      <View style={s.between}><Text style={s.text}>Quantity ({m.unit}s)</Text><Quantity value={quantity} max={available} onChange={setQuantity} /></View>
      <View style={[s.between, { borderTopWidth: 1, borderColor: colors.line, paddingTop: 16 }]}><Text style={s.text}>Item subtotal</Text><Text style={s.price}>{money(offer.price * quantity)}</Text></View>
    </> : <Text style={s.muted}>Choose an available pharmacy above, then set your quantity.</Text>}
      {!!message && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{message}</Text>}<Button title="Add to cart" icon="cart" disabled={!offer || available < quantity} onPress={() => add()} />
      {offer && available < quantity && <Text style={s.muted}>All available units are already in your cart.</Text>}
    </Card>}
    <Modal visible={replace} transparent animationType="fade" onRequestClose={() => setReplace(false)}>
      <View style={{ flex: 1, backgroundColor: '#162A2480', justifyContent: 'center', padding: 24 }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 440, alignSelf: 'center' }}><Card>
        <Text accessibilityRole="header" style={s.heading}>Switch pharmacy?</Text><Text style={s.text}>Your cart contains items from {pharmacies.find(p => p.id === items[0]?.pharmacyId)?.name}. Adding this item from {pharmacies.find(p => p.id === selected)?.name} will replace those items. Each cart is for one pharmacy.</Text>
        <Button title="Keep current cart" secondary onPress={() => setReplace(false)} /><Button title="Replace cart and add item" onPress={() => add(true)} />
      </Card></ScrollView></View>
    </Modal>
  </Page>;
}
