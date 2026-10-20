import { useRef, useState, useId, type ComponentRef } from 'react';
import { View, Pressable, ScrollView, TextInput, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useCart } from '../state/cart';
import { useCheckout } from '../state/checkout';
import { useOrders } from '../state/orders';
import { addressText, quoteCheckout, validateCheckout, type Fulfillment } from '../domain/checkout';
import { money } from '../data/catalog';
import { Page, Back, Card, Button, TextLink, Badge, Text, colors, s } from '../components/ui';
import { Icon, type IconName } from '../components/icon';
import { CheckoutField } from '../components/checkout-field';
import { AddressEditor } from '../components/address-editor';
import { CheckoutSummary } from '../components/checkout-summary';

export default function Checkout() {
  const { items, setItems } = useCart();
  const { draft, setDraft } = useCheckout();
  const { placeOrder, approvals } = useOrders();
  const submissionKey = useId();
  const submitting = useRef(false);
  const [submitError, setSubmitError] = useState('');
  const [placedId, setPlacedId] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);
  const wide = useWindowDimensions().width >= 900;
  const quote = quoteCheckout(items, draft.method, approvals);
  const errors = attempted ? validateCheckout(draft) : {};
  function showReview() {
    setAttempted(true);
    const current = validateCheckout(draft);
    if (current.name) { nameRef.current?.focus(); return; }
    if (current.phone) { phoneRef.current?.focus(); return; }
    if (current.address) { setEditingAddress(true); return; }
    if (!quote.ok) return;
    setReview(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setSubmitError('');
    const result = await placeOrder(items, draft, submissionKey);
    if (!result.ok) { setSubmitError(result.issue); submitting.current = false; return; }
    setPlacedId(result.order.id);
    setItems([]);
    router.replace({ pathname: '/orders/[id]/confirmation', params: { id: result.order.id } });
  }
  function editDetails() { setReview(false); scrollRef.current?.scrollTo({ y: 0, animated: false }); }
  if (placedId) return <Page><Text style={s.title}>Order preview saved</Text><Text style={s.muted}>Opening the confirmation. {placedId.startsWith('DEMO-') ? 'It is saved in this app session.' : 'It is saved to your account.'}</Text><Button title="View confirmation" onPress={() => router.replace({ pathname: '/orders/[id]/confirmation', params: { id: placedId } })} /></Page>;
  if (!quote.ok) return <Page><Back title="Checkout" /><Card><Text style={s.heading}>{!items.length ? 'Your cart is empty' : 'Check your cart'}</Text><Text accessibilityRole="alert" style={s.text}>{quote.issue}</Text><Button title={!items.length ? 'Browse medicines' : 'Return to cart'} onPress={() => router.replace(!items.length ? '/search' : '/cart')} /></Card></Page>;
  const methods: { value: Fulfillment; title: string; description: string; icon: IconName }[] = [
    { value: 'pickup', title: 'Pickup', description: 'Collect at the pharmacy', icon: 'pickup' },
    { value: 'delivery', title: 'Delivery', description: 'To your entered address', icon: 'delivery' },
  ];
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Page scrollRef={scrollRef}><Back title={review ? 'Review checkout' : 'Checkout'} onBack={review ? editDetails : undefined} />
      <View style={{ gap: 8 }}><Badge text="Checkout preview" neutral /><Text style={s.muted}>{review ? 'Step 2 of 2 · Review your details. Nothing has been submitted.' : 'Step 1 of 2 · Choose how to receive your items. Use sample contact details.'}</Text></View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}><Icon name="pharmacy" color={colors.muted} /><View style={{ flex: 1, gap: 4 }}><Text style={s.caption}>Your selected pharmacy</Text><Text style={s.heading}>{quote.pharmacy.name}</Text><Text style={s.muted}>{quote.pharmacy.address}</Text></View></View>
          <View style={{ gap: 12 }}><Text accessibilityRole="header" style={s.heading}>Order items</Text><View style={s.list}>{quote.lines.map((line, index) => <View key={line.medicine.id} style={[{ padding: 16, gap: 8 }, index < quote.lines.length - 1 && s.divider]}>
            <Text style={{ fontWeight: '600' }}>{line.medicine.name}</Text>{line.approval && <Badge text={`Demo Rx review · ${line.approval.prescriptionId} v${line.approval.revision}`} />}<Text style={s.muted}>{line.medicine.strength} · {line.medicine.form}</Text><View style={s.between}><Text style={s.muted}>{line.quantity} {line.medicine.unit}{line.quantity === 1 ? '' : 's'} × {money(line.unitPrice)}</Text><Text style={s.price}>{money(line.subtotal)}</Text></View>
          </View>)}</View><TextLink title="Edit cart" icon="arrow-right" onPress={() => router.push('/cart')} /></View>
          {review ? <>
            <Card><Text style={s.heading}>Recipient</Text><Text style={s.text}>{draft.name.trim()}</Text><Text style={s.text}>{draft.phone.trim()}</Text></Card>
            <Card><Text style={s.heading}>{draft.method === 'delivery' ? 'Delivery address' : 'Pickup at pharmacy'}</Text><Text style={s.text}>{draft.method === 'delivery' && draft.address ? addressText(draft.address) : quote.pharmacy.address}</Text>{draft.method === 'pickup' && <Text style={s.muted}>Sample opening hours: {quote.pharmacy.hours}</Text>}</Card>
          </> : <>
            <View style={{ gap: 12 }}><Text accessibilityRole="header" style={s.heading}>Receive your order</Text><View accessibilityRole="radiogroup" style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>{methods.map(method => {
              const selected = draft.method === method.value;
              return <Pressable key={method.value} accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected }} accessibilityLabel={method.title} onPress={() => setDraft(previous => ({ ...previous, method: method.value }))}
                style={{ flex: wide ? 1 : undefined, padding: 16, borderWidth: 2, borderColor: selected ? colors.teal : colors.line, borderRadius: 10, backgroundColor: colors.white, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name={method.icon} color={selected ? colors.teal : colors.muted} /><Text style={{ fontWeight: '600', flex: 1 }}>{method.title}</Text>{selected && <Icon name="check" size={18} />}</View><Text style={s.muted}>{method.description}</Text>
              </Pressable>;
            })}</View></View>
            <Card><Text accessibilityRole="header" style={s.heading}>Recipient details</Text><Text style={s.muted}>Required for both pickup and delivery.</Text>
              <CheckoutField ref={nameRef} label="Full name *" value={draft.name} onChangeText={name => setDraft(previous => ({ ...previous, name }))} error={errors.name} maxLength={100} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
              <CheckoutField ref={phoneRef} label="Mobile number *" placeholder="09XXXXXXXXX or +639XXXXXXXXX" value={draft.phone} onChangeText={phone => setDraft(previous => ({ ...previous, phone }))} error={errors.phone} maxLength={24} keyboardType="phone-pad" autoCorrect={false} autoCapitalize="none" returnKeyType="done" />
            </Card>
            <Card><Text accessibilityRole="header" style={s.heading}>{draft.method === 'delivery' ? 'Delivery address' : 'Pickup location'}</Text>
              {draft.method === 'pickup' ? <><Text style={s.text}>{quote.pharmacy.name}</Text><Text style={s.muted}>{quote.pharmacy.address}</Text><Text style={s.muted}>Sample opening hours: {quote.pharmacy.hours}</Text></> : <>
                <Text style={s.muted}>{draft.address ? addressText(draft.address) : 'Add the address where you would like to receive your items.'}</Text>
                {!!errors.address && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 14, lineHeight: 22 }}>{errors.address}</Text>}
                <Button title={draft.address ? 'Edit delivery address' : 'Add delivery address'} secondary icon="map-pin" onPress={() => setEditingAddress(true)} />
              </>}
            </Card>
          </>}
          <Card><Text accessibilityRole="header" style={s.heading}>Payment</Text><Text style={{ fontWeight: '600' }}>{quote.payment}</Text><Text style={s.muted}>{draft.method === 'delivery' ? 'Pay in cash when the order is delivered.' : 'Pay when collecting from the selected pharmacy.'} No online payment or card details are collected.</Text></Card>
        </View>
        <View style={{ width: wide ? 320 : '100%', gap: 16 }}>
          <CheckoutSummary quote={quote} />
          {review ? <><Card><Text style={s.heading}>Create order preview</Text><Text style={s.muted}>This saves a simulated order to your account when signed in. It does not reserve stock, charge you, or contact the pharmacy.</Text><Button title="Place order preview" icon="check" onPress={submit} />{!!submitError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{submitError}</Text>}</Card><Button title="Edit checkout details" secondary onPress={editDetails} /><TextLink title="Back to cart" onPress={() => router.push('/cart')} /></> : <>
            <Button title="Review checkout" icon="arrow-right" onPress={showReview} />
            {!!Object.keys(errors).length && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 14, lineHeight: 22 }}>Check the highlighted fields before continuing.</Text>}
            <Text style={s.caption}>Details stay while you navigate within this app session. Refreshing or restarting clears the cart and checkout draft.</Text>
          </>}
        </View>
      </View>
      <AddressEditor visible={editingAddress} address={draft.address} onCancel={() => setEditingAddress(false)} onSave={address => { setDraft(previous => ({ ...previous, address })); setEditingAddress(false); }} />
    </Page>
  </KeyboardAvoidingView>;
}
