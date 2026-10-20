import { Pressable, View } from 'react-native';
import type { Medicine } from '../data/catalog';
import { Icon } from './icon';
import { Badge, colors, Text, s } from './ui';

export function MedicineRow({ medicine: m, onPress, last = false, price, stock, actionLabel = 'View medicine' }: {
  medicine: Medicine; onPress: () => void; last?: boolean; price?: string; stock?: number; actionLabel?: string;
}) {
  return <Pressable accessibilityRole="link" accessibilityLabel={`${actionLabel}: ${m.name}, ${m.strength}, ${m.form}`} onPress={onPress}
    style={({ pressed }) => [{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.neutral : colors.white }, !last && s.divider]}>
    <View style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#F3F5F4' }}><Icon name="medicine" size={24} color={colors.muted} /></View>
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={{ fontSize: 17, lineHeight: 25, fontWeight: '600' }}>{m.name}</Text>
      <Text style={s.muted}>{m.strength} · {m.form}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Badge text={m.prescription ? 'Rx only' : 'OTC'} warning={m.prescription} neutral={!m.prescription} />
        {price && <Text style={{ fontSize: 14, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{price} / {m.unit}</Text>}
        {stock !== undefined && <Text style={s.caption}>{stock ? `${stock} available` : 'Out of stock'}</Text>}
      </View>
    </View><Icon name="arrow-right" size={18} color={colors.muted} />
  </Pressable>;
}
