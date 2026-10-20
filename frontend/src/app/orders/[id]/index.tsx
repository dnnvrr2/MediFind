import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrders } from '../../../state/orders';
import { orderQuote, orderTime } from '../../../domain/orders';
import { Page, Button, Card, Text, s } from '../../../components/ui';
import { OrderHeading, OrderItems, OrderRecipient, OrderDestination, MissingOrder } from '../../../components/order-record';
import { OrderStatusPanel } from '../../../components/order-status';
import { CheckoutSummary } from '../../../components/checkout-summary';
import { OrderActions } from '../../../components/order-actions';
import { api } from '../../../api/client';

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, refreshOrders } = useOrders(); const order = orders.find(order => order.id === id);
  const [deliveryCode, setDeliveryCode] = useState('');
  useEffect(() => { refreshOrders(); const timer = setInterval(refreshOrders, 20000); return () => clearInterval(timer); }, [id]);
  useEffect(() => { let live = true; if (order?.status === 'out_for_delivery') api.customerDeliveryCode(id).then(result => { if (live) setDeliveryCode(result.code); }).catch(() => { if (live) setDeliveryCode(''); }); else setDeliveryCode(''); return () => { live = false; }; }, [id, order?.status]);
  const wide = useWindowDimensions().width >= 900;
  if (!order) return <Page><MissingOrder /></Page>;
  return <Page><OrderHeading title="Order details" order={order} /><OrderStatusPanel order={order} />
    <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 24 }}>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 24 }}>
        <Card><Text style={s.heading}>{order.pharmacy.name}</Text><Text style={s.muted}>{order.pharmacy.address}</Text></Card>
        <OrderItems order={order} /><OrderRecipient order={order} /><OrderDestination order={order} />
        <Card><Text style={s.heading}>Status history</Text>{order.events.map((event, i) => <View key={i} style={{ gap: 4 }}><Text style={s.caption}>{orderTime(event.at)}</Text><Text style={s.text}>{event.note}</Text></View>)}</Card>
      </View>
      <View style={{ width: wide ? 320 : '100%', gap: 16 }}><CheckoutSummary quote={orderQuote(order)} />{order.status === 'out_for_delivery' && <Card><Text style={s.heading}>Delivery confirmation code</Text><Text style={s.muted}>Give this code to the rider only when you receive the sealed order.</Text><Text accessibilityLabel="Delivery confirmation code" style={[s.title, { letterSpacing: 5 }]}>{deliveryCode || '••••••'}</Text></Card>}<Button title="Track demo order" icon="orders" onPress={() => router.push({ pathname: '/orders/[id]/tracking', params: { id: order.id } })} /><OrderActions order={order} /></View>
    </View>
  </Page>;
}
