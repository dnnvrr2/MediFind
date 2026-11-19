import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { lookupBranchAddress } from '../api/places';
import { cdoBarangayAt } from '../domain/cdo';
import { defaultArea } from '../domain/locations';
import type { MapPoint } from '../domain/places';
import { BranchPinMap } from './branch-pin-map';
import { CheckoutField } from './checkout-field';
import { Button, Text, colors, s } from './ui';

export function BranchAddressPicker({ initialPin, initialAddress, onConfirm, onCancel }: {
  initialPin: MapPoint | null; initialAddress: string;
  onConfirm: (pin: MapPoint, address: string) => void; onCancel: () => void;
}) {
  const [pin, setPin] = useState(initialPin);
  const [address, setAddress] = useState(initialAddress);
  const [reviewing, setReviewing] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const activeLookup = useRef<AbortController | null>(null);
  useEffect(() => () => activeLookup.current?.abort(), []);
  const barangay = pin ? cdoBarangayAt(pin) : null;

  function selectPin(next: MapPoint) {
    activeLookup.current?.abort();
    activeLookup.current = null;
    setLookingUp(false);
    setPin({ lat: Number(next.lat.toFixed(6)), lon: Number(next.lon.toFixed(6)) });
  }

  async function reviewAddress() {
    if (!pin || activeLookup.current) return;
    if (initialPin?.lat === pin.lat && initialPin.lon === pin.lon) {
      setReviewing(true);
      return;
    }
    const controller = new AbortController();
    activeLookup.current = controller;
    setLookingUp(true);
    const timer = setTimeout(() => controller.abort(), 5000);
    let suggestion = '';
    try { suggestion = await lookupBranchAddress(pin, controller.signal); }
    catch { /* Address confirmation also works when the lookup is unavailable. */ }
    finally {
      clearTimeout(timer);
      if (activeLookup.current === controller) {
        activeLookup.current = null;
        setAddress(suggestion || (!initialPin ? initialAddress : ''));
        setLookingUp(false);
        setReviewing(true);
      }
    }
  }

  function cancel() {
    const current = activeLookup.current;
    activeLookup.current = null;
    current?.abort();
    onCancel();
  }

  return <Modal visible transparent animationType="fade" onRequestClose={cancel}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#162A2480', padding: 16, justifyContent: 'center' }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 620, maxHeight: '94%', alignSelf: 'center', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.white }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, padding: 18 }}>
          <Text accessibilityRole="header" style={s.heading}>{reviewing ? 'Confirm branch address' : 'Pin your pharmacy'}</Text>
          {reviewing ? <>
            {!address && barangay && <Text style={s.muted}>{barangay.name}, {defaultArea}</Text>}
            <CheckoutField label="Full branch address" required multiline maxLength={500} value={address} onChangeText={setAddress} />
            <Text style={s.caption}>Check the building and street against your business permit.</Text>
            <Button title="Confirm address" icon="check" disabled={!address.trim()} onPress={() => { if (pin && address.trim()) onConfirm(pin, address.trim()); }} />
            <Button title="Adjust pin" secondary onPress={() => setReviewing(false)} />
          </> : <>
            <Text style={s.muted}>Tap the branch entrance to place the pin.</Text>
            <BranchPinMap pin={pin} onPin={selectPin} />
            <Button title={lookingUp ? 'Looking up address...' : 'Review address'} disabled={!pin || lookingUp} onPress={() => void reviewAddress()} />
          </>}
          <Button title="Cancel" secondary onPress={cancel} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
