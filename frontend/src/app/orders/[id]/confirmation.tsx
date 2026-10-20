import { View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrders } from '../../../state/orders';
import { orderQuote } from '../../../domain/orders';
import { Page, Button, TextLink, Text, colors, s } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { OrderHeading, OrderDestination, OrderItems, OrderRecipient, MissingOrder } from '../../../components/order-record';
import { OrderStatusPanel } from '../../../components/order-status';
import { CheckoutSummary } from '../../../components/checkout-summary';

export default function OrderConfirmation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders } = useOrders(); const order = orders.find(order => order.id === id);
  const wide = useWindowDimensions().width >= 900;
  if (!order) return <Page><MissingOrder /></Page>;
  return <Page><OrderHeading title="Order confirmation" order={order} />
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ padding: 12, borderRadius: 24, backgroundColor: colors.pale }}><Icon name="check" size={24} /></View><View style={{ flex: 1, gap: 4 }}><Text style={s.heading}>Demo order created</Text><Text style={s.muted}>Saved in this app session. Nothing was sent to a pharmacy, charged, or reserved.</Text></View></View>
    <OrderStatusPanel order={order} />
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 24 }}><Text style={s.heading}>{order.pharmacy.name}</Text><OrderItems order={order} /><OrderRecipient order={order} /><OrderDestination order={order} /></View>
      <View style={{ width: wide ? 320 : '100%', gap: 16 }}><CheckoutSummary quote={orderQuote(order)} /><Button title="Track demo order" icon="orders" onPress={() => router.replace({ pathname: '/orders/[id]/tracking', params: { id: order.id } })} /><Button title="View order details" secondary onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: order.id } })} /><TextLink title="Continue shopping" onPress={() => router.navigate('/')} /></View>
    </View>
  </Page>;
}
