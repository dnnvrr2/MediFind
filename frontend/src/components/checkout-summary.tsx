import { View } from 'react-native';
import { money } from '../data/catalog';
import type { CheckoutQuote } from '../domain/checkout';
import { Card, Text, s, colors } from './ui';

export function CheckoutSummary({ quote }: { quote: Extract<CheckoutQuote, { ok: true }> }) {
  return <Card>
    <Text accessibilityRole="header" style={s.heading}>Order summary</Text>
    <View style={s.between}><Text style={s.text}>Subtotal</Text><Text style={s.price}>{money(quote.subtotal)}</Text></View>
    <View style={s.between}><Text style={s.muted}>{quote.method === 'delivery' ? 'Delivery fee (sample)' : 'Pickup fee'}</Text><Text style={s.text}>{quote.deliveryFee ? money(quote.deliveryFee) : 'Free'}</Text></View>
    <View style={[s.between, { borderTopWidth: 1, borderColor: colors.line, paddingTop: 16 }]}><Text style={{ fontWeight: '600' }}>Total</Text><Text accessibilityLabel={`Checkout total ${money(quote.total)}`} style={[s.price, { fontSize: 24, lineHeight: 32 }]}>{money(quote.total)}</Text></View>
    <Text style={s.muted}>{quote.payment}</Text>
    <Text style={s.caption}>{quote.method === 'delivery' ? 'Estimated fee; confirm coverage and charges with the pharmacy.' : 'Pay at the pharmacy.'}</Text>
  </Card>;
}
