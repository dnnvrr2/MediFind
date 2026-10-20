import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrders } from '../../state/orders';
import { isCurrentOrder, orderTime } from '../../domain/orders';
import { money } from '../../data/catalog';
import { Page, Back, Button, Text, colors, s } from '../../components/ui';
import { Icon } from '../../components/icon';
import { OrderStatusBadge } from '../../components/order-status';

export default function Orders() {
  const { orders, loading, syncIssue } = useOrders();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const previous = tab === 'previous';
  const shown = orders.filter(order => isCurrentOrder(order) !== previous);
  return <Page><Back title="My Orders" onBack={() => router.navigate('/')} /><Text style={s.muted}>{loading ? 'Loading saved orders…' : 'Preview orders are saved to your account when signed in. Nothing is sent to a pharmacy.'}</Text>{!!syncIssue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{syncIssue}</Text>}
    <View accessibilityRole="tablist" style={s.row}>{['current', 'previous'].map(value => <Pressable key={value} accessibilityRole="tab" aria-selected={(value === 'previous') === previous} accessibilityState={{ selected: (value === 'previous') === previous }} onPress={() => router.setParams({ tab: value })} style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderBottomWidth: 2, borderColor: (value === 'previous') === previous ? colors.teal : 'transparent' }}><Text style={{ fontWeight: '600', color: (value === 'previous') === previous ? colors.teal : colors.muted }}>{value === 'previous' ? 'Previous' : 'Current'}</Text></Pressable>)}</View>
    <Text style={s.muted}>{shown.length} {previous ? 'previous' : 'current'} demo {shown.length === 1 ? 'order' : 'orders'}</Text>
    {shown.map(order => <Pressable key={order.id} accessibilityRole="link" accessibilityLabel={`View order ${order.id}`} onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })} style={({ pressed }) => [s.card, { backgroundColor: pressed ? colors.neutral : colors.white }]}>
      <View style={s.between}><Text style={s.heading}>#{order.id}</Text><OrderStatusBadge status={order.status} /></View><Text style={s.caption}>{orderTime(order.createdAt)}</Text>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="pharmacy" size={20} color={colors.muted} /><Text style={{ flex: 1, fontWeight: '600' }}>{order.pharmacy.name}</Text></View>
      <Text style={s.muted}>{order.lines.length} {order.lines.length === 1 ? 'item' : 'items'} · {order.method === 'pickup' ? 'Pickup' : 'Delivery'} · {order.payment}</Text>
      <View style={s.between}><Text style={s.price}>{money(order.total)}</Text><View style={s.row}><Text style={s.link}>View details</Text><Icon name="arrow-right" size={18} /></View></View>
    </Pressable>)}
    {!shown.length && <View style={{ alignItems: 'center', paddingVertical: 32, gap: 16 }}><Icon name="orders" size={40} color={colors.muted} /><Text style={s.heading}>{previous ? 'No previous demo orders' : 'No current demo orders'}</Text><Text style={[s.muted, { textAlign: 'center', maxWidth: 400 }]}>{previous ? 'Completed, cancelled, rejected, and failed demo orders will appear here.' : 'Create a demo order from your cart to see it here.'}</Text><Button title="Browse medicines" onPress={() => router.push('/search')} /></View>}
  </Page>;
}
