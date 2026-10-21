import { View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrders } from '../../../state/orders';
import { orderQuote } from '../../../domain/orders';
import { Page, Button, Card, Text, s } from '../../../components/ui';
import { OrderHeading, OrderDestination, MissingOrder } from '../../../components/order-record';
import { OrderStatusPanel } from '../../../components/order-status';
import { OrderTimeline } from '../../../components/order-timeline';
import { OrderActions } from '../../../components/order-actions';
import { CheckoutSummary } from '../../../components/checkout-summary';
import { DestinationMap } from '../../../components/destination-map';
import { addressText } from '../../../domain/checkout';

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, loading, syncIssue } = useOrders(); const order = orders.find(order => order.id === id);
  const wide = useWindowDimensions().width >= 900;
  if (!order) return <Page>{loading ? <Text style={s.muted}>Loading order...</Text> : <><MissingOrder />{!!syncIssue && <Text accessibilityRole="alert">{syncIssue}</Text>}</>}</Page>;
  return <Page><OrderHeading title="Order tracking" order={order} /><OrderStatusPanel order={order} />
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 24 }}><OrderDestination order={order} /><Card><Text style={s.heading}>{order.method === 'delivery' ? 'Delivery area' : 'Pickup area'}</Text><DestinationMap address={order.method === 'delivery' ? (order.address ? addressText(order.address) : '') : order.pharmacy.address} barangay={order.method === 'delivery' ? order.address?.barangay : undefined} city={order.method === 'delivery' ? order.address?.city : undefined} tracking={order.method === 'delivery'} verifiedPoint={order.method === 'pickup' ? order.pharmacy.point : undefined} /></Card><OrderTimeline order={order} /></View>
      <View style={{ width: wide ? 320 : '100%', gap: 16 }}><CheckoutSummary quote={orderQuote(order)} /><Button title="View order details" secondary onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })} /><OrderActions order={order} preview /></View>
    </View>
  </Page>;
}
