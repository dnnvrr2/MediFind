import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCatalog, searchMedicines } from '../data/catalog';
import { Page, Back, Search, Button, FilterChips, Text, colors, s } from '../components/ui';
import { Icon } from '../components/icon';
import { MedicineRow } from '../components/medicine-row';

export default function SearchResults() {
  const { status: catalogStatus } = useCatalog();
  const params = useLocalSearchParams<{ q?: string; filter?: string }>();
  const q = typeof params.q === 'string' ? params.q : '';
  const filter = params.filter === 'OTC' || params.filter === 'Rx' ? params.filter : 'All';
  const [query, setQuery] = useState(q);
  useEffect(() => setQuery(q), [q]);
  const results = searchMedicines(q, filter);
  return <Page scrollKey={`search:${q}:${filter}`}><Back title="Search medicines" /><Search value={query} onChange={setQuery} onSubmit={() => router.setParams({ q: query, filter })} />
    <View style={s.row}><Icon name="filter" size={18} color={colors.muted} /><FilterChips options={[{ value: 'All', label: 'All' }, { value: 'OTC', label: 'OTC' }, { value: 'Rx', label: 'Prescription' }]} selected={filter} onSelect={value => router.setParams({ filter: value })} accessibilityLabel="Filter medicines by type" style={{ flex: 1, minWidth: 0 }} /></View>
    {catalogStatus === 'ready' && results.length > 0 && <Text accessibilityLiveRegion="polite" style={s.muted}>{results.length} {results.length === 1 ? 'result' : 'results'}{q ? ` for “${q}”` : ' in the catalog'}</Text>}
    {!!results.length && <View style={s.list}>{results.map((m, i) => <MedicineRow key={m.id} medicine={m} last={i === results.length - 1} onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: m.id } })} />)}</View>}
    {catalogStatus !== 'ready' && <Text style={s.muted}>{catalogStatus === 'loading' ? 'Loading catalog...' : 'Catalog unavailable. Try again shortly.'}</Text>}
    {catalogStatus === 'ready' && !results.length && <View style={{ gap: 16, alignItems: 'center', paddingVertical: 32 }}><Icon name="search" size={36} color={colors.muted} /><Text style={s.heading}>No medicines found</Text><Text style={[s.muted, { textAlign: 'center' }]}>Try the generic name or remove the strength or filter.</Text><Button title="Browse all medicines" secondary onPress={() => router.setParams({ q: '', filter: 'All' })} /></View>}
  </Page>;
}
