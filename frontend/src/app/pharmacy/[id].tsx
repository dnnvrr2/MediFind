import { View, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCatalog, medicines, pharmacies, offers, money } from '../../data/catalog';
import { Page, Back, Badge, Button, Text, colors, s } from '../../components/ui';
import { DestinationMap } from '../../components/destination-map';
import { Icon } from '../../components/icon';
import { MedicineRow } from '../../components/medicine-row';

export default function PharmacyDetails() {
  useCatalog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = pharmacies.find(p => p.id === id);
  if (!p) return <Page><Back title="Pharmacy not found" /></Page>;
  const listings = offers.filter(o => o.pharmacyId === id);
  return <Page><Back title="Pharmacy details" /><View style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}><Icon name="pharmacy" size={28} color={colors.muted} /><Text style={[s.title, { flex: 1 }]}>{p.name}</Text></View>
    <View style={{ flexDirection: 'row', gap: 10 }}><Icon name="map-pin" size={20} color={colors.muted} /><Text style={[s.text, { flex: 1 }]}>{p.address}</Text></View>
    <View style={s.row}><Icon name="clock" size={20} color={colors.muted} /><Text style={s.muted}>{p.hours}</Text></View><Text style={s.muted}>{p.phone}</Text><Badge text={p.live ? (p.isOpen ? "Open" : "Closed") : "Sample listing"} neutral={!p.live || !p.isOpen} />
    {/^[+\d][\d\s()-]{6,}$/.test(p.phone) && <Button title="Call pharmacy" secondary onPress={() => Linking.openURL(`tel:${p.phone.replace(/[^+\d]/g, '')}`)} />}
  </View><DestinationMap address={p.address} verifiedPoint={p.point} /><Text accessibilityRole="header" style={s.heading}>Listed medicines</Text><View style={s.list}>{listings.map((o, i) => {
    const m = medicines.find(m => m.id === o.medicineId)!;
    return <MedicineRow key={m.id} medicine={m} last={i === listings.length - 1} price={money(o.price)} stock={o.stock} actionLabel="Compare availability" onPress={() => router.push({ pathname: '/availability/[id]', params: { id: m.id } })} />;
  })}</View></Page>;
}
