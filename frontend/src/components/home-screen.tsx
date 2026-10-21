import { useState } from 'react';
import { View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Page, Search, TextLink, colors, Text, s } from '../components/ui';
import { Icon } from '../components/icon';
import { MedicineRow } from '../components/medicine-row';
import { LocationPicker } from './location-picker';
import { useLocation } from '../state/location';
import { matchesArea } from '../domain/locations';
import { useProfile } from '../state/profile';
import { useCatalog, medicines, pharmacies } from '../data/catalog';

export function HomeScreen({ guest = false }: { guest?: boolean }) {
  useCatalog();
  const { profile } = useProfile();
  const { area } = useLocation();
  const localPharmacies = pharmacies.filter(p => matchesArea(p.address, area));
  const customer = !guest && profile;
  const [query, setQuery] = useState('');
  const wide = useWindowDimensions().width >= 900;
  const search = (q = query) => router.push({ pathname: '/search', params: { q } });
  return <Page sectionGap={wide ? 20 : undefined}>
    <View style={{ gap: wide ? 16 : 20, backgroundColor: '#0B7165', padding: wide ? 32 : 24, borderRadius: 18 }}>
      <LocationPicker onDark />
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontSize: wide ? 30 : 28, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8, color: colors.white }}>Find your medicine before you walk out the door</Text>
        <Text style={{ color: '#E0F0EC', fontSize: 16, lineHeight: 24 }}>Compare pharmacy prices and stock.</Text>
      </View>
      <View><Search value={query} onChange={setQuery} onSubmit={() => search()} inline={wide} onDark /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text numberOfLines={1} style={{ flexShrink: 0, color: '#E0F0EC', fontSize: 13, lineHeight: 22 }}>Common</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{['Paracetamol', 'Cetirizine'].map(t => <Pressable key={t} accessibilityRole="button" onPress={() => search(t)} style={({ pressed }) => ({ borderWidth: 1, borderColor: '#86BDB2', borderRadius: 22, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', backgroundColor: pressed ? '#064E46' : '#0A6258' })}><Text numberOfLines={1} style={{ color: colors.white, fontSize: 13, lineHeight: 22, fontWeight: '500' }}>{t}</Text></Pressable>)}</ScrollView></View>
    </View>
    <View style={{ gap: 12 }}>
      <Pressable accessibilityRole="link" onPress={() => router.push('/pharmacies')} style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: pressed ? colors.pale : colors.white }]}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name="pharmacy" size={25} color={colors.teal} /></View>
        <View style={{ flex: 1, gap: 6 }}><Text style={s.heading}>Browse pharmacies</Text></View>
        <Icon name="arrow-right" size={20} color={colors.muted} />
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push(guest ? { pathname: '/account/sign-in', params: { returnTo: '/prescriptions/upload' } } : '/prescriptions/upload')} style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: pressed ? colors.pale : colors.white }]}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name="prescription" size={25} color={colors.teal} /></View>
        <View style={{ flex: 1, gap: 6 }}><Text style={s.heading}>Have a prescription?</Text><Text style={s.muted}>{customer ? 'Upload for pharmacy review.' : 'Sign in to upload.'}</Text></View>
        <Icon name="arrow-right" size={20} color={colors.muted} />
      </Pressable>
    </View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 32 : 28, alignItems: 'flex-start' }}>
      <View style={{ flex: wide ? 1.6 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
        <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Browse medicines</Text><TextLink title="View all" icon="arrow-right" onPress={() => search('')} /></View>
        <View style={s.list}>{medicines.slice(0, 3).map((m, i) => <MedicineRow key={m.id} medicine={m} last={i === 2} onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: m.id } })} />)}</View>
      </View>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
        <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Pharmacies</Text><TextLink title="View all" icon="arrow-right" onPress={() => router.push('/pharmacies')} /></View>
        <View style={s.list}>{!localPharmacies.length && <View style={{ padding: 20, gap: 8 }}><Text style={s.heading}>No pharmacies in this area</Text><Text style={s.muted}>Change your location to browse available listings.</Text><LocationPicker /></View>}{localPharmacies.map((p, i) => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`View ${p.name}`} onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} style={({ pressed }) => [{ padding: 16, gap: 8, backgroundColor: pressed ? colors.neutral : colors.white }, i < localPharmacies.length - 1 && s.divider]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="pharmacy" size={20} color={colors.muted} /><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', flex: 1 }}>{p.name}</Text><Icon name="arrow-right" size={16} color={colors.muted} /></View><Text style={s.muted}>{p.address}</Text>
        </Pressable>)}</View>
      </View>
    </View>
    {guest && <TextLink title="Partner with us" icon="pharmacy" onPress={() => router.push('/partnership')} />}
  </Page>;
}
