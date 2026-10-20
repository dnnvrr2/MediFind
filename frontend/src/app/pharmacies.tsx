import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { pharmacies } from '../data/catalog';
import { Page, Back, Text, colors, s } from '../components/ui';
import { Icon } from '../components/icon';

export default function Pharmacies() {
  return <Page><Back title="Pharmacies" /><View style={s.row}><Icon name="map-pin" size={18} color={colors.muted} /><Text style={s.muted}>Sample area: Cagayan de Oro City</Text></View>
    <Text style={s.muted}>Browse sample listings. Location selection and live distances are not available yet.</Text>
    <View style={s.list}>{pharmacies.map((p, i) => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`View pharmacy: ${p.name}`} onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} style={({ pressed }) => [{ padding: 18, gap: 12, backgroundColor: pressed ? colors.neutral : colors.white }, i < pharmacies.length - 1 && s.divider]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name="pharmacy" size={24} color={colors.muted} /><Text style={[s.heading, { flex: 1 }]}>{p.name}</Text><Icon name="arrow-right" size={20} color={colors.muted} /></View>
      <Text style={s.muted}>{p.address}</Text><View style={s.row}><Icon name="clock" size={16} color={colors.muted} /><Text style={s.muted}>{p.hours}</Text></View>
    </Pressable>)}</View>
  </Page>;
}
