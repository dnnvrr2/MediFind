import { View } from 'react-native';
import { statusInfo, type DemoOrder, type OrderStatus } from '../domain/orders';
import { Text, colors, s } from './ui';
import { Icon } from './icon';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const info = statusInfo[status];
  const bg = info.tone === 'danger' ? '#FBEDEA' : info.tone === 'warning' ? '#FFF3DA' : info.tone === 'success' ? colors.pale : colors.neutral;
  const color = info.tone === 'danger' ? colors.danger : info.tone === 'warning' ? colors.warning : info.tone === 'success' ? colors.teal : colors.muted;
  return <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignSelf: 'flex-start', maxWidth: '100%' }}><Text style={{ color, fontSize: 12, lineHeight: 18, fontWeight: '600' }}>{info.label}</Text></View>;
}

export function OrderStatusPanel({ order }: { order: DemoOrder }) {
  const info = statusInfo[order.status];
  const note = order.events[order.events.length - 1]?.note;
  return <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 16, backgroundColor: colors.white, gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name={info.tone === 'danger' ? 'alert' : order.status === 'delivered' || order.status === 'collected' ? 'check' : 'clock'} color={info.tone === 'danger' ? colors.danger : colors.teal} /><OrderStatusBadge status={order.status} /></View>
    <Text style={s.text}>{info.description}</Text>
    {['cancelled', 'rejected', 'delivery_failed'].includes(order.status) && !!note && <Text style={s.muted}>Reason: {note}</Text>}
  </View>;
}
