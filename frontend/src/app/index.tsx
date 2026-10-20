import { useState } from 'react';
import { View, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Page, Search, TextLink, colors, Text, s } from '../components/ui';
import { Icon } from '../components/icon';
import { MedicineRow } from '../components/medicine-row';
import { medicines, pharmacies } from '../data/catalog';

export default function Home() {
  const [query, setQuery] = useState('');
  const wide = useWindowDimensions().width >= 900;
  const search = (q = query) => router.push({ pathname: '/search', params: { q } });
  return <Page sectionGap={wide ? 20 : undefined}>
    <View style={{ gap: wide ? 16 : 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="map-pin" size={18} color={colors.muted} /><Text style={s.muted}>Sample area: Cagayan de Oro City</Text></View>
      <View style={{ gap: 8 }}><Text accessibilityRole="header" style={[s.title, { fontSize: wide ? 30 : 28, lineHeight: 36 }]}>Find a medicine</Text><Text style={s.text}>Search by name or generic, then compare pharmacy prices.</Text></View>
      <Search value={query} onChange={setQuery} onSubmit={() => search()} inline={wide} />
      <View style={[s.row, { gap: 8 }]}><Text style={s.caption}>Try</Text>{['Paracetamol', 'Cetirizine'].map(t => <Pressable key={t} accessibilityRole="button" onPress={() => search(t)} style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', backgroundColor: pressed ? colors.neutral : colors.white })}><Text style={{ fontSize: 14, lineHeight: 22 }}>{t}</Text></Pressable>)}</View>
    </View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 32 : 28, alignItems: 'flex-start' }}>
      <View style={{ flex: wide ? 1.6 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
        <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Browse medicines</Text><TextLink title="View all" icon="arrow-right" onPress={() => search('')} /></View>
        <View style={s.list}>{medicines.slice(0, 3).map((m, i) => <MedicineRow key={m.id} medicine={m} last={i === 2} onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: m.id } })} />)}</View>
      </View>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
        <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Pharmacies</Text><TextLink title="View all" icon="arrow-right" onPress={() => router.push('/pharmacies')} /></View>
        <View style={s.list}>{pharmacies.map((p, i) => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`View ${p.name}`} onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} style={({ pressed }) => [{ padding: 16, gap: 8, backgroundColor: pressed ? colors.neutral : colors.white }, i < pharmacies.length - 1 && s.divider]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="pharmacy" size={20} color={colors.muted} /><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', flex: 1 }}>{p.name}</Text><Icon name="arrow-right" size={16} color={colors.muted} /></View><Text style={s.muted}>{p.address}</Text>
        </Pressable>)}</View>
      </View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 }}><Icon name="prescription" size={20} color={colors.muted} /><Text style={[s.muted, { flex: 1 }]}>Prescription medicines need pharmacist review. Explore local file upload and simulated review in Prescriptions.</Text></View>
  </Page>;
}
