import { useEffect, useMemo, useState } from 'react';
import { TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCatalog, searchMedicines, pharmacies, offers, money } from '../data/catalog';
import { Page, Back, Search, Button, FilterChips, Text, colors, s } from '../components/ui';
import { Icon } from '../components/icon';
import { MedicineRow } from '../components/medicine-row';
import { useLocation } from '../state/location';
import { matchesArea } from '../domain/locations';
import { LocationPicker } from '../components/location-picker';

type SortMode = 'Relevant' | 'Price: low to high' | 'Price: high to low' | 'Distance';
type Availability = 'All' | 'In stock';
type ProductType = 'All' | 'Generic' | 'Brand';

function SkeletonRows() {
  return <View accessibilityLabel="Loading medicines" accessibilityRole="progressbar" style={s.list}>{[0, 1, 2, 3].map((i) => <View key={i} style={[{ flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center' }, i < 3 && s.divider]}><View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: '#E8EFEC' }} /><View style={{ flex: 1, gap: 9 }}><View style={{ width: '58%', height: 14, borderRadius: 7, backgroundColor: '#E8EFEC' }} /><View style={{ width: '34%', height: 11, borderRadius: 6, backgroundColor: '#F0F4F2' }} /></View></View>)}</View>;
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function SearchResults() {
  const { status: catalogStatus } = useCatalog();
  const params = useLocalSearchParams<{ q?: string; filter?: string }>();
  const q = typeof params.q === 'string' ? params.q : '';
  const filter = params.filter === 'OTC' || params.filter === 'Rx' ? params.filter : 'All';
  const [query, setQuery] = useState(q);
  const [productType, setProductType] = useState<ProductType>('All');
  const [availability, setAvailability] = useState<Availability>('All');
  const [sort, setSort] = useState<SortMode>('Relevant');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const { area, point } = useLocation();
  const wide = useWindowDimensions().width >= 760;
  useEffect(() => setQuery(q), [q]);

  const rows = useMemo(() => {
    const allowedPharmacies = pharmacies.filter(p => matchesArea(p.address, area));
    const allowedIds = new Set(allowedPharmacies.map(p => p.id));
    const low = minPrice.trim() ? Number(minPrice) : null;
    const high = maxPrice.trim() ? Number(maxPrice) : null;
    const distanceLimit = maxDistance.trim() ? Number(maxDistance) : null;
    const validLow = low !== null && Number.isFinite(low) && low >= 0 ? low : null;
    const validHigh = high !== null && Number.isFinite(high) && high >= 0 ? high : null;
    const validDistance = distanceLimit !== null && Number.isFinite(distanceLimit) && distanceLimit >= 0 ? distanceLimit : null;
    return searchMedicines(q, filter).filter(m => productType === 'All' || (productType === 'Generic' ? m.name.trim().toLowerCase() === m.generic.trim().toLowerCase() : m.name.trim().toLowerCase() !== m.generic.trim().toLowerCase())).map(m => {
      const localOffers = offers.filter(o => o.medicineId === m.id && allowedIds.has(o.pharmacyId));
      const pricedOffers = localOffers.filter(o => (availability === 'All' || o.stock > 0) && (validLow === null || o.price >= validLow) && (validHigh === null || o.price <= validHigh));
      const distances = allowedPharmacies.filter(p => pricedOffers.some(o => o.pharmacyId === p.id) && p.point && point).map(p => distanceKm(point!, p.point!));
      const nearest = distances.length ? Math.min(...distances) : null;
      const available = localOffers.length > 0 && pricedOffers.length > 0;
      const withinDistance = validDistance === null || (nearest !== null && nearest <= validDistance);
      return { medicine: m, localOffers, pricedOffers, available, nearest, withinDistance, minOffer: pricedOffers.length ? Math.min(...pricedOffers.map(o => o.price)) : null };
    }).filter(row => row.available && row.withinDistance).sort((a, b) => {
      if (sort === 'Price: low to high') return (a.minOffer ?? Infinity) - (b.minOffer ?? Infinity);
      if (sort === 'Price: high to low') return (b.minOffer ?? -Infinity) - (a.minOffer ?? -Infinity);
      if (sort === 'Distance' && point) return (a.nearest ?? Infinity) - (b.nearest ?? Infinity);
      return 0;
    });
  }, [area, availability, filter, maxDistance, maxPrice, minPrice, point, productType, q, sort]);

  const numberInput = (label: string, value: string, change: (v: string) => void, placeholder: string) => <View style={{ flex: 1, minWidth: 130, gap: 5 }}><Text style={s.caption}>{label}</Text><TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={value} onChangeText={v => change(v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))} placeholder={placeholder} placeholderTextColor={colors.muted} style={[s.input, { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#AEBFB7', borderRadius: 8, backgroundColor: colors.white }]} /></View>;

  return <Page scrollKey={`search:${q}:${filter}`}><Back title="Search medicines" />
    <LocationPicker />
    <Search value={query} onChange={setQuery} onSubmit={() => router.setParams({ q: query, filter })} />
    <View style={{ gap: 14, padding: wide ? 18 : 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white }}>
      <View style={{ gap: 6 }}><Text style={s.caption}>MEDICINE TYPE</Text><FilterChips options={[{ value: 'All', label: 'All types' }, { value: 'OTC', label: 'OTC' }, { value: 'Rx', label: 'Prescription' }]} selected={filter} onSelect={value => router.setParams({ filter: value })} accessibilityLabel="Filter medicines by prescription type" /></View>
      <View style={{ gap: 6 }}><Text style={s.caption}>BRAND OR GENERIC</Text><FilterChips options={[{ value: 'All', label: 'All' }, { value: 'Generic', label: 'Generic' }, { value: 'Brand', label: 'Brand' }]} selected={productType} onSelect={setProductType} accessibilityLabel="Filter generic or brand medicines" /></View>
      <View style={{ gap: 6 }}><Text style={s.caption}>AVAILABILITY</Text><FilterChips options={[{ value: 'All', label: 'All stock' }, { value: 'In stock', label: 'In stock' }]} selected={availability} onSelect={setAvailability} accessibilityLabel="Filter by stock availability" /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {numberInput('Minimum price (₱)', minPrice, setMinPrice, 'Any')}
        {numberInput('Maximum price (₱)', maxPrice, setMaxPrice, 'Any')}
        {numberInput('Within distance (km)', maxDistance, setMaxDistance, 'Any')}
      </View>
      {!point && !!maxDistance && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="location" size={17} color={colors.muted} /><Text style={[s.caption, { flex: 1 }]}>Choose a precise location to filter by distance.</Text></View>}
      {!point && !maxDistance && <View style={s.between}><Text style={s.caption}>SORT</Text><Text style={s.caption}>Distance sorting uses a precise selected location.</Text></View>}
      <View style={{ gap: 6 }}><Text style={s.caption}>SORT RESULTS</Text><FilterChips options={[{ value: 'Relevant', label: 'Recommended' }, { value: 'Price: low to high', label: 'Price ↑' }, { value: 'Price: high to low', label: 'Price ↓' }, { value: 'Distance', label: 'Distance' }]} selected={sort} onSelect={setSort} accessibilityLabel="Sort medicine results" /></View>
    </View>
    {catalogStatus === 'ready' && <Text accessibilityLiveRegion="polite" style={s.muted}>{rows.length} {rows.length === 1 ? 'result' : 'results'}{q ? ` for “${q}”` : ` near ${area}`}</Text>}
    {catalogStatus === 'loading' && <SkeletonRows />}
    {catalogStatus === 'unavailable' && <View style={[s.card, { alignItems: 'center' }]}><Text style={s.muted}>Catalog unavailable. Try again shortly.</Text></View>}
    {catalogStatus === 'ready' && !!rows.length && <View style={s.list}>{rows.map((row, i) => <MedicineRow key={row.medicine.id} medicine={row.medicine} last={i === rows.length - 1} price={row.minOffer === null ? undefined : money(row.minOffer)} stock={row.localOffers.reduce((sum, offer) => sum + offer.stock, 0)} onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: row.medicine.id } })} />)}</View>}
    {catalogStatus === 'ready' && !rows.length && <View style={{ gap: 16, alignItems: 'center', paddingVertical: 32 }}><Icon name="search" size={36} color={colors.muted} /><Text style={s.heading}>No medicines found</Text><Text style={[s.muted, { textAlign: 'center' }]}>Try another search or adjust your filters.</Text><Button title="Clear filters" secondary onPress={() => { setProductType('All'); setAvailability('All'); setSort('Relevant'); setMinPrice(''); setMaxPrice(''); setMaxDistance(''); router.setParams({ q: '', filter: 'All' }); }} /></View>}
  </Page>;
}
