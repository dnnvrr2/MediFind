import { useState } from 'react';
import { Modal, Pressable, ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { allowedTransitions, type DemoOrder, type OrderStatus } from '../domain/orders';
import { useOrders } from '../state/orders';
import { Button, Card, Text, colors, s } from './ui';
import { CheckoutField } from './checkout-field';
import { Icon } from './icon';

const actionLabels: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Simulate pharmacy confirmation', preparing: 'Simulate preparation', ready_for_pickup: 'Simulate ready for pickup',
  collected: 'Simulate collection', out_for_delivery: 'Simulate dispatch', delivered: 'Simulate delivery', rejected: 'Simulate pharmacy rejection', delivery_failed: 'Simulate delivery failure',
};

export function OrderActions({ order, preview = false }: { order: DemoOrder; preview?: boolean }) {
  const { updateOrder } = useOrders();
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const transitions = allowedTransitions(order);
  const canCancel = transitions.includes('cancelled');
  const requiredReason = target === 'rejected' || target === 'delivery_failed';
  function open(status: OrderStatus) { setTarget(status); setReason(''); setError(''); }
  async function update(status: OrderStatus, note = '') {
    const result = await updateOrder(order.id, status, note);
    if (result.ok) { setTarget(null); setError(''); }
    else setError(result.issue);
  }
  return <View style={{ gap: 16 }}>
    {canCancel && <><Button title="Cancel demo order" secondary onPress={() => open('cancelled')} /><Text style={s.caption}>Cancellation is available only before pharmacy confirmation.</Text></>}
    {preview && <View style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, gap: 12 }}>
      <Pressable accessibilityRole="button" aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="filter" color={colors.muted} size={20} /><Text style={[s.link, { flex: 1 }]}>Preview status controls</Text><Icon name={expanded ? 'minus' : 'plus'} size={18} color={colors.muted} /></Pressable>
      {expanded && <><Text style={s.muted}>These controls simulate pharmacy and rider updates. They do not contact anyone, dispatch a rider, or collect payment.</Text>{transitions.filter(status => status !== 'cancelled').map(status => <Button key={status} title={actionLabels[status] ?? status} secondary onPress={() => status === 'rejected' || status === 'delivery_failed' ? open(status) : update(status)} />)}{!transitions.length && <Text style={s.muted}>This demo order is closed. Create another demo order to try a different outcome.</Text>}</>}
    </View>}
    {!!error && !target && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    <Modal visible={target !== null} transparent animationType="none" onRequestClose={() => setTarget(null)}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#162A2480', padding: 20, justifyContent: 'center' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' }}><Card>
          <Text accessibilityRole="header" style={s.heading}>{target === 'cancelled' ? 'Cancel this demo order?' : target === 'rejected' ? 'Simulate pharmacy rejection' : 'Simulate delivery failure'}</Text>
          <Text style={s.text}>{target === 'cancelled' ? 'This closes the demo order. It cannot be resumed, and its items will not be added back to your cart automatically.' : 'Enter a sample reason. It will appear on the order details and tracking screens.'}</Text>
          <CheckoutField label={requiredReason ? 'Reason *' : 'Reason (optional)'} value={reason} onChangeText={setReason} multiline maxLength={240} style={{ minHeight: 96 }} />
          {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
          <Button title={target === 'cancelled' ? 'Confirm cancellation' : 'Apply simulated outcome'} onPress={() => target && update(target, reason)} />
          <Button title={target === 'cancelled' ? 'Keep order' : 'Go back'} secondary onPress={() => { setTarget(null); setError(''); }} />
        </Card></ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
