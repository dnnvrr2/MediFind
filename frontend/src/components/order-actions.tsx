import { useState } from 'react';
import { Modal, View } from 'react-native';
import type { Order } from '../domain/orders';
import { useOrders } from '../state/orders';
import { Button, Card, Text, colors, s } from './ui';

export function OrderActions({ order }: { order: Order }) {
  const { cancelOrder } = useOrders();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!order.managed || order.status !== 'awaiting_confirmation') return null;

  async function confirmCancel() {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await cancelOrder(order.id);
    setBusy(false);
    if (result.ok) setOpen(false);
    else setError(result.issue);
  }

  return <>
    <Button title="Cancel order" secondary onPress={() => { setError(''); setOpen(true); }} />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={{ flex: 1, backgroundColor: '#162A2480', padding: 20, justifyContent: 'center' }}>
        <View accessibilityViewIsModal style={{ maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <Card>
            <Text accessibilityRole="header" style={s.heading}>Cancel this order?</Text>
            <Text style={s.text}>Cancelled items will need to be added to your cart again.</Text>
            {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
            <Button title={busy ? 'Cancelling...' : 'Confirm cancellation'} disabled={busy} onPress={confirmCancel} />
            <Button title="Keep order" secondary disabled={busy} onPress={() => setOpen(false)} />
          </Card>
        </View>
      </View>
    </Modal>
  </>;
}
