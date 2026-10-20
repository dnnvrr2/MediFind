import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, View, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { emptyAddress, validateAddress, type DeliveryAddress, type AddressErrors } from '../domain/checkout';
import { CheckoutField } from './checkout-field';
import { Button, Text, colors, s } from './ui';

export function AddressEditor({ visible, address, onSave, onCancel }: {
  visible: boolean; address: DeliveryAddress | null; onSave: (address: DeliveryAddress) => void; onCancel: () => void;
}) {
  const [values, setValues] = useState(emptyAddress);
  const [attempted, setAttempted] = useState(false);
  const streetRef = useRef<ComponentRef<typeof TextInput>>(null);
  const barangayRef = useRef<ComponentRef<typeof TextInput>>(null);
  const cityRef = useRef<ComponentRef<typeof TextInput>>(null);
  const provinceRef = useRef<ComponentRef<typeof TextInput>>(null);
  const postalRef = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => { if (visible) { setValues(address ? { ...address } : emptyAddress()); setAttempted(false); } }, [visible, address]);
  const errors: AddressErrors = attempted ? validateAddress(values) : {};
  function save() {
    setAttempted(true);
    const current = validateAddress(values);
    if (Object.keys(current).length) {
      if (current.street) streetRef.current?.focus();
      else if (current.barangay) barangayRef.current?.focus();
      else if (current.city) cityRef.current?.focus();
      else if (current.province) provinceRef.current?.focus();
      else postalRef.current?.focus();
      return;
    }
    onSave(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])) as DeliveryAddress);
  }
  const change = (key: keyof DeliveryAddress, value: string) => setValues(previous => ({ ...previous, [key]: value }));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#162A2480', justifyContent: 'center', padding: 16 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ width: '100%', maxWidth: 560, maxHeight: '95%', alignSelf: 'center', backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text accessibilityRole="header" style={s.heading}>{address ? 'Edit delivery address' : 'Add delivery address'}</Text>
          <Text style={s.muted}>Use a sample address for this preview. Required fields are marked *.</Text>
          <CheckoutField ref={streetRef} label="House/building and street *" placeholder="House number, street, building or unit" value={values.street} onChangeText={value => change('street', value)} error={errors.street} maxLength={160} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => barangayRef.current?.focus()} />
          <CheckoutField ref={barangayRef} label="Barangay *" value={values.barangay} onChangeText={value => change('barangay', value)} error={errors.barangay} maxLength={80} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => cityRef.current?.focus()} />
          <CheckoutField ref={cityRef} label="City / municipality *" value={values.city} onChangeText={value => change('city', value)} error={errors.city} maxLength={80} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => provinceRef.current?.focus()} />
          <CheckoutField ref={provinceRef} label="Province *" value={values.province} onChangeText={value => change('province', value)} error={errors.province} maxLength={80} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => postalRef.current?.focus()} />
          <CheckoutField ref={postalRef} label="Postal code (optional)" value={values.postalCode} onChangeText={value => change('postalCode', value)} error={errors.postalCode} maxLength={4} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={save} />
          <Button title="Save address" icon="check" onPress={save} />
          <Button title="Cancel" secondary onPress={onCancel} />
          <Text style={s.caption}>Kept only for this app session. Saving an address does not submit an order or confirm delivery coverage.</Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
