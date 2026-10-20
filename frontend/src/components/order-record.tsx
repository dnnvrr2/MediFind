import { View } from 'react-native';
import { router } from 'expo-router';
import { addressText } from '../domain/checkout';
import { isCurrentOrder, orderTime, type DemoOrder } from '../domain/orders';
import { money } from '../data/catalog';
import { Back, Badge, Button, Card, Text, s } from './ui';

export function OrderHeading({ order, title }: { order: DemoOrder; title: string }) {
  return <><Back title={title} onBack={() => router.navigate({ pathname: '/orders', params: { tab: isCurrentOrder(order) ? 'current' : 'previous' } })} /><View style={{ gap: 6 }}><Badge text="Demo order · session only" neutral /><Text style={s.heading}>#{order.id}</Text><Text style={s.muted}>{orderTime(order.createdAt)}</Text></View></>;
}

export function OrderItems({ order }: { order: DemoOrder }) {
  return <View style={{ gap: 12 }}><Text accessibilityRole="header" style={s.heading}>Order items</Text><View style={s.list}>{order.lines.map((line, index) => <View key={line.medicine.id} style={[{ padding: 16, gap: 8 }, index < order.lines.length - 1 && s.divider]}>
    <Text style={{ fontWeight: '600' }}>{line.medicine.name}</Text>{line.approval && <Badge text={`Demo Rx review · ${line.approval.prescriptionId} v${line.approval.revision}`} />}<Text style={s.muted}>{line.medicine.strength} · {line.medicine.form}</Text><View style={s.between}><Text style={s.muted}>{line.quantity} {line.medicine.unit}{line.quantity === 1 ? '' : 's'} × {money(line.unitPrice)}</Text><Text style={s.price}>{money(line.subtotal)}</Text></View>
  </View>)}</View></View>;
}

export function OrderRecipient({ order }: { order: DemoOrder }) {
  return <Card><Text style={s.heading}>Recipient</Text><Text style={s.text}>{order.recipient.name}</Text><Text style={s.text}>{order.recipient.phone}</Text></Card>;
}

export function OrderDestination({ order }: { order: DemoOrder }) {
  return <Card><Text style={s.heading}>{order.method === 'delivery' ? 'Delivery address' : 'Pickup location'}</Text>{order.method === 'pickup' && <Text style={s.text}>{order.pharmacy.name}</Text>}<Text style={s.text}>{order.method === 'delivery' && order.address ? addressText(order.address) : order.pharmacy.address}</Text>{order.method === 'pickup' && <Text style={s.muted}>Sample opening hours: {order.pharmacy.hours}</Text>}</Card>;
}

export function MissingOrder() {
  return <><Back title="Demo order not found" onBack={() => router.replace('/orders')} /><Card><Text style={s.text}>This order is not in the current app session.</Text><Text style={s.muted}>Refreshing or restarting clears demo orders. No order is stored by a pharmacy.</Text><Button title="My Orders" onPress={() => router.replace('/orders')} /></Card></>;
}
