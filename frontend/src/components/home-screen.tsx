import { useState } from 'react';
import { View, Pressable, useWindowDimensions } from 'react-native';
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
  const { status: catalogStatus } = useCatalog();
  const { profile } = useProfile();
  const { area } = useLocation();
  const featuredMedicines = medicines.slice(0, 3);
  const localPharmacies = pharmacies.filter(p => matchesArea(p.address, area));
  const customer = !guest && profile;
  const [query, setQuery] = useState('');
  const wide = useWindowDimensions().width >= 900;
  const search = (q = query) => router.push({ pathname: '/search', params: { q } });
  return <Page sectionGap={wide ? 20 : undefined}>
    <View style={{ gap: wide ? 16 : 20, backgroundColor: '#0B7165', padding: wide ? 32 : 24, borderRadius: 18 }}>
      <LocationPicker onDark />
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontSize: wide ? 30 : 28, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8, color: colors.white }}>Find medicines</Text>
      </View>
      <View><Search value={query} onChange={setQuery} onSubmit={() => search()} inline={wide} onDark /></View>
    </View>
    <View style={{ gap: 12 }}>
      <Pressable accessibilityRole="link" onPress={() => router.push(guest ? { pathname: '/account/sign-in', params: { returnTo: '/prescriptions/upload' } } : '/prescriptions/upload')} style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: pressed ? colors.pale : colors.white }]}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name="prescription" size={25} color={colors.teal} /></View>
        <View style={{ flex: 1, gap: 6 }}><Text style={s.heading}>Have a prescription?</Text><Text style={s.muted}>{customer ? 'Upload for pharmacy review.' : 'Sign in to upload.'}</Text></View>
        <Icon name="arrow-right" size={20} color={colors.muted} />
      </Pressable>
    </View>
    {catalogStatus !== 'ready' && <Text style={s.muted}>{catalogStatus === 'loading' ? 'Loading catalog...' : 'Catalog unavailable. Try again shortly.'}</Text>}
    {catalogStatus === 'ready' && <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 32 : 28, alignItems: 'flex-start' }}>
      <View style={{ flex: wide ? 1.6 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
        <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Browse medicines</Text><TextLink title="View all" icon="arrow-right" onPress={() => search('')} /></View>
        <View style={s.list}>{!featuredMedicines.length && <Text style={[s.muted, { padding: 16 }]}>No medicines listed yet.</Text>}{featuredMedicines.map((m, i) => <MedicineRow key={m.id} medicine={m} last={i === featuredMedicines.length - 1} onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: m.id } })} />)}</View>
      </View>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
        <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Pharmacies</Text><TextLink title="View all" icon="arrow-right" onPress={() => router.push({ pathname: '/pharmacies', params: { scope: 'all' } })} /></View>
        <View style={s.list}>{!localPharmacies.length && <View style={{ padding: 20, gap: 8 }}><Text style={s.muted}>No pharmacies listed in this area.</Text></View>}{localPharmacies.map((p, i) => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`View ${p.name}`} onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} style={({ pressed }) => [{ padding: 16, gap: 8, backgroundColor: pressed ? colors.neutral : colors.white }, i < localPharmacies.length - 1 && s.divider]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="pharmacy" size={20} color={colors.muted} /><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', flex: 1 }}>{p.name}</Text><Icon name="arrow-right" size={16} color={colors.muted} /></View><Text style={s.muted}>{p.address}</Text>
        </Pressable>)}</View>
      </View>
    </View>}
    {guest && <TextLink title="Partner with us" icon="pharmacy" onPress={() => router.push('/partnership')} />}
  </Page>;
}
