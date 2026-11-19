import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, View, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { detectCdoLocation } from '../api/device-location';
import { emptyAddress, validateAddress, type DeliveryAddress } from '../domain/checkout';
import { CheckoutField } from './checkout-field';
import { Button, Text, colors, s } from './ui';

export function AddressEditor({ visible, address, onSave, onCancel }: {
  visible: boolean; address: DeliveryAddress | null; onSave: (address: DeliveryAddress) => void; onCancel: () => void;
}) {
  const [values, setValues] = useState(emptyAddress);
  const [attempted, setAttempted] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [locationIssue, setLocationIssue] = useState('');
  const detectionId = useRef(0);
  const streetRef = useRef<ComponentRef<typeof TextInput>>(null);
  const barangayRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (visible) {
      setValues(address ? { ...address } : emptyAddress());
      setAttempted(false);
      setDetecting(false);
      setLocationIssue('');
    }
    return () => { detectionId.current++; };
  }, [visible, address]);

  const errors = attempted ? validateAddress(values) : {};

  function save() {
    setAttempted(true);
    const current = validateAddress(values);
    if (current.street) { streetRef.current?.focus(); return; }
    if (current.barangay) { barangayRef.current?.focus(); return; }
    detectionId.current++;
    onSave({ ...values, street: values.street.trim(), barangay: values.barangay.trim(), city: values.city.trim() || emptyAddress().city });
  }

  function cancel() {
    detectionId.current++;
    onCancel();
  }

  function changeBarangay(barangay: string) {
    detectionId.current++;
    setDetecting(false);
    setLocationIssue('');
    setValues(previous => ({ ...previous, barangay }));
  }

  async function useDeviceLocation() {
    const id = ++detectionId.current;
    setDetecting(true);
    setLocationIssue('');
    try {
      const place = await detectCdoLocation();
      if (id === detectionId.current) {
        setValues(previous => ({ ...emptyAddress(), street: place.street || previous.street, barangay: place.barangay }));
      }
    } catch (error) {
      if (id === detectionId.current) {
        setLocationIssue(error instanceof Error ? error.message : 'Could not detect your location. Enter your barangay manually.');
      }
    } finally {
      if (id === detectionId.current) setDetecting(false);
    }
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#162A2480', justifyContent: 'center', padding: 16 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 560, maxHeight: '95%', alignSelf: 'center', backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text accessibilityRole="header" style={s.heading}>{address ? 'Edit delivery address' : 'Add delivery address'}</Text>
          <Button title={detecting ? 'Detecting location...' : 'Use my location'} secondary icon="map-pin" disabled={detecting} onPress={useDeviceLocation} />
          {!!locationIssue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{locationIssue}</Text>}
          <CheckoutField ref={streetRef} label="House/building and street" required value={values.street} onChangeText={street => setValues(previous => ({ ...previous, street }))} error={errors.street} maxLength={160} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => barangayRef.current?.focus()} />
          <CheckoutField ref={barangayRef} label="Barangay" required value={values.barangay} onChangeText={changeBarangay} error={errors.barangay} maxLength={80} autoCapitalize="words" returnKeyType="done" onSubmitEditing={save} />
          <Button title="Save address" icon="check" onPress={save} />
          <Button title="Cancel" secondary onPress={cancel} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
