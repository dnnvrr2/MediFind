import { View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrders } from '../../../state/orders';
import { orderQuote } from '../../../domain/orders';
import { Page, Button, Text, s } from '../../../components/ui';
import { OrderHeading, OrderDestination, MissingOrder } from '../../../components/order-record';
import { OrderStatusPanel } from '../../../components/order-status';
import { OrderTimeline } from '../../../components/order-timeline';
import { OrderActions } from '../../../components/order-actions';
import { CheckoutSummary } from '../../../components/checkout-summary';

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders } = useOrders(); const order = orders.find(order => order.id === id);
  const wide = useWindowDimensions().width >= 900;
  if (!order) return <Page><MissingOrder /></Page>;
  return <Page><OrderHeading title="Order tracking" order={order} /><OrderStatusPanel order={order} />
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 24 }}><OrderTimeline order={order} /><OrderDestination order={order} /><Text style={s.muted}>Pharmacy: {order.pharmacy.name}. No real pharmacy or rider updates are connected.</Text></View>
      <View style={{ width: wide ? 320 : '100%', gap: 16 }}><CheckoutSummary quote={orderQuote(order)} /><Button title="View order details" secondary onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })} /><OrderActions order={order} preview /></View>
    </View>
  </Page>;
}
