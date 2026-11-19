import { useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLocation } from '../state/location';
import { LocationPicker } from '../components/location-picker';
import { matchesArea } from '../domain/locations';
import { useCatalog, pharmacies } from '../data/catalog';
import { Page, Back, Badge, Text, TextLink, colors, s } from '../components/ui';
import { Icon } from '../components/icon';

export default function Pharmacies() {
  const { status: catalogStatus } = useCatalog();
  const { area } = useLocation();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const showAll = scope === 'all';
  const [query, setQuery] = useState('');
  const listings = pharmacies.filter(p => (showAll || matchesArea(p.address, area)) && `${p.address} ${p.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Page><Back title="Pharmacies" />
    <View style={s.row}>
      <LocationPicker onSelect={() => { if (showAll) router.setParams({ scope: 'area' }); }} />
      <TextLink title={showAll ? 'Use selected area' : 'View all'} onPress={() => router.setParams({ scope: showAll ? 'area' : 'all' })} />
    </View>
    <TextInput accessibilityLabel="Filter pharmacies by area or name" placeholder="Area or pharmacy name" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={[s.input, { minHeight: 50, flex: undefined, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.white }]} />{catalogStatus === 'ready' && listings.length > 0 && <Text accessibilityLiveRegion="polite" style={s.caption}>{listings.length} {listings.length === 1 ? 'pharmacy' : 'pharmacies'}{query.trim() ? ` matching ${query.trim()}` : ""}</Text>}{catalogStatus !== 'ready' && <Text style={s.muted}>{catalogStatus === 'loading' ? 'Loading pharmacies...' : 'Pharmacies could not be loaded.'}</Text>}{catalogStatus === 'ready' && !listings.length && <View style={s.card}><Text style={s.heading}>No pharmacies found</Text><Text style={s.muted}>{showAll ? (query.trim() ? 'Try another search.' : 'No pharmacies are listed yet.') : 'Change your location or select View all.'}</Text></View>}<View style={s.list}>{listings.map((p, i) => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`View pharmacy: ${p.name}`} onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} style={({ pressed }) => [{ padding: 18, gap: 12, backgroundColor: pressed ? colors.neutral : colors.white }, i < listings.length - 1 && s.divider]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name="pharmacy" size={24} color={colors.muted} /><Text style={[s.heading, { flex: 1 }]}>{p.name}</Text><Icon name="arrow-right" size={20} color={colors.muted} /></View>
      <Text style={s.muted}>{p.address}</Text><View style={s.row}><Badge text={p.isOpen ? "Open" : "Closed"} neutral={!p.isOpen} /><Badge text={p.acceptsOrders === false ? "Not accepting orders" : "Accepting orders"} neutral={p.acceptsOrders === false} /></View><View style={s.row}><Icon name="clock" size={16} color={colors.muted} /><Text style={s.muted}>{p.hours}</Text></View>
    </Pressable>)}</View>
  </Page>;
}
