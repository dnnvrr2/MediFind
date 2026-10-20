import { View, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { medicines, pharmacies, offers, money } from '../data/catalog';
import { useOrders } from '../state/orders';
import { approvalFor } from '../domain/prescriptions';
import { quoteCheckout } from '../domain/checkout';
import { cartTotal, changeQuantity } from '../domain/cart';
import { useCart } from '../state/cart';
import { Page, Back, Card, Button, Quantity, TextLink, Text, Badge, colors, s } from '../components/ui';
import { EmptyCartIllustration, Icon } from '../components/icon';

export default function Cart() {
  const { items, setItems } = useCart();
  const { approvals } = useOrders();
  const quote = quoteCheckout(items, 'pickup', approvals);
  const pharmacy = pharmacies.find(p => p.id === items[0]?.pharmacyId);
  const wide = useWindowDimensions().width >= 900;
  return <Page><Back title="Shopping cart" />{!items.length ? <View style={{ alignItems: 'center', gap: 16, paddingVertical: 16 }}>
    <EmptyCartIllustration /><Text style={s.heading}>Your cart is empty</Text><Text style={[s.muted, { textAlign: 'center', maxWidth: 360 }]}>Find a medicine and choose a pharmacy to add your first item.</Text><Button title="Browse medicines" icon="search" onPress={() => router.push('/search')} />
  </View> : <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
    <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 16 }}>
      {pharmacy && <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingBottom: 6 }}><Icon name="pharmacy" color={colors.muted} /><View style={{ flex: 1, gap: 4 }}><Text style={s.caption}>Your pharmacy</Text><Text style={s.heading}>{pharmacy.name}</Text><Text style={s.muted}>{pharmacy.address}</Text></View></View>}
      <View style={s.list}>{items.map((i, index) => {
        const m = medicines.find(m => m.id === i.medicineId)!;
        const o = offers.find(o => o.medicineId === i.medicineId && o.pharmacyId === i.pharmacyId)!;
        return <View key={i.medicineId} style={[{ padding: 18, gap: 14 }, index < items.length - 1 && s.divider]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}><Icon name="medicine" size={24} color={colors.muted} /><View style={{ flex: 1, gap: 5 }}><Text style={s.heading}>{m.name}</Text><Text style={s.muted}>{m.strength} · {m.form}</Text><Text style={s.muted}>{money(o.price)} per {m.unit}</Text>{i.prescriptionId && <Badge text={approvalFor(i, approvals) ? `Demo Rx review · ${i.prescriptionId} v${i.revision}` : 'Approval no longer valid · remove this item'} warning={!approvalFor(i, approvals)} />}</View></View>
          <View style={s.between}><Quantity value={i.quantity} max={i.prescriptionId ? Math.min(o.stock, approvals.find(g => g.prescriptionId === i.prescriptionId && g.revision === i.revision && g.medicineId === i.medicineId)?.quantity ?? 0) : o.stock} onChange={q => setItems(previous => changeQuantity(previous, i.medicineId, q, approvals))} /><Text style={s.price}>{money(o.price * i.quantity)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.name} ${m.form} from cart`} onPress={() => setItems(previous => previous.filter(row => row.medicineId !== i.medicineId))} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}><Icon name="trash" size={18} color={colors.danger} /><Text style={{ color: colors.danger, fontSize: 14, lineHeight: 22 }}>Remove</Text></Pressable>
        </View>;
      })}</View><TextLink title="Prescription history" onPress={() => router.push('/prescriptions')} /><TextLink title="Continue shopping" icon="arrow-right" onPress={() => router.push('/search')} />
    </View>
    <View style={{ width: wide ? 320 : '100%' }}><Card><Text style={s.heading}>Order summary</Text><View style={s.between}><Text style={s.text}>Subtotal</Text><Text style={[s.price, { fontSize: 24, lineHeight: 32 }]}>{money(cartTotal(items))}</Text></View><Text style={s.muted}>Choose pickup or delivery at checkout to see the sample fee.</Text>{!quote.ok && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{quote.issue}</Text>}<Button disabled={!quote.ok} title="Proceed to checkout" icon="arrow-right" onPress={() => router.push('/checkout')} /><Text style={s.caption}>No orders are accepted in this preview. The cart clears when you refresh or restart the app.</Text></Card></View>
  </View>}</Page>;
}
