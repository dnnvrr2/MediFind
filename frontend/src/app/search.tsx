import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { searchMedicines } from '../data/catalog';
import { Page, Back, Search, Button, Text, colors, s } from '../components/ui';
import { Icon } from '../components/icon';
import { MedicineRow } from '../components/medicine-row';

export default function SearchResults() {
  const params = useLocalSearchParams<{ q?: string; filter?: string }>();
  const q = typeof params.q === 'string' ? params.q : '';
  const filter = params.filter === 'OTC' || params.filter === 'Rx' ? params.filter : 'All';
  const [query, setQuery] = useState(q);
  useEffect(() => setQuery(q), [q]);
  const results = searchMedicines(q, filter);
  return <Page><Back title="Search medicines" /><Search value={query} onChange={setQuery} onSubmit={() => router.setParams({ q: query, filter })} />
    <View style={s.row}><Icon name="filter" size={18} color={colors.muted} />{['All', 'OTC', 'Rx'].map(f => <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: filter === f }} aria-pressed={filter === f} onPress={() => router.setParams({ filter: f })} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: filter === f ? colors.teal : colors.line, backgroundColor: filter === f ? colors.pale : colors.white }}><Text style={{ fontSize: 14, lineHeight: 22, fontWeight: '500', color: filter === f ? colors.teal : colors.muted }}>{f === 'Rx' ? 'Prescription' : f}</Text></Pressable>)}</View>
    <Text accessibilityLiveRegion="polite" style={s.muted}>{results.length} {results.length === 1 ? 'result' : 'results'}{q ? ` for “${q}”` : ' in the sample catalog'}</Text>
    {!!results.length && <View style={s.list}>{results.map((m, i) => <MedicineRow key={m.id} medicine={m} last={i === results.length - 1} onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: m.id } })} />)}</View>}
    {!results.length && <View style={{ gap: 16, alignItems: 'center', paddingVertical: 32 }}><Icon name="search" size={36} color={colors.muted} /><Text style={s.heading}>No medicines found</Text><Text style={[s.muted, { textAlign: 'center' }]}>Try the generic name or remove the strength or filter.</Text><Button title="Browse all medicines" secondary onPress={() => router.setParams({ q: '', filter: 'All' })} /></View>}
  </Page>;
}
