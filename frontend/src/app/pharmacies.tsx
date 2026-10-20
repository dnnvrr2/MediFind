import { useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useLocation } from '../state/location';
import { AreaMap } from '../components/area-map';
import { LocationPicker } from '../components/location-picker';
import { matchesArea } from '../domain/locations';
import { pharmacies } from '../data/catalog';
import { Page, Back, Text, colors, s } from '../components/ui';
import { Icon } from '../components/icon';

export default function Pharmacies() {
  const { area } = useLocation();
  const [query, setQuery] = useState('');
  const listings = pharmacies.filter(p => matchesArea(p.address, area) && `${p.address} ${p.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Page><Back title="Pharmacies" /><LocationPicker /><AreaMap area={area} height={260} />
    <Text style={s.muted}>Browse sample listings. Enter an area or pharmacy name below. Live distances are not available.</Text>
    <TextInput accessibilityLabel="Filter pharmacies by area or name" placeholder="Area or pharmacy name" value={query} onChangeText={setQuery} style={[s.input, { minHeight: 50, flex: undefined, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.white }]} /><Text accessibilityLiveRegion="polite" style={s.caption}>{listings.length} sample pharmacies{` in ${area}`}{query.trim() ? ` matching ${query.trim()}` : ""}</Text>{!listings.length && <View style={s.card}><Text style={s.heading}>No sample pharmacies in this area</Text><Text style={s.muted}>The current sample catalog covers Cagayan de Oro City. Try a different area or clear your search.</Text></View>}<View style={s.list}>{listings.map((p, i) => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`View pharmacy: ${p.name}`} onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} style={({ pressed }) => [{ padding: 18, gap: 12, backgroundColor: pressed ? colors.neutral : colors.white }, i < listings.length - 1 && s.divider]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name="pharmacy" size={24} color={colors.muted} /><Text style={[s.heading, { flex: 1 }]}>{p.name}</Text><Icon name="arrow-right" size={20} color={colors.muted} /></View>
      <Text style={s.muted}>{p.address}</Text><View style={s.row}><Icon name="clock" size={16} color={colors.muted} /><Text style={s.muted}>{p.hours}</Text></View>
    </Pressable>)}</View>
  </Page>;
}
