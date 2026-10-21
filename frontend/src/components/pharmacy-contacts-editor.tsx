import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text, s } from './ui';
import { CheckoutField } from './checkout-field';
import { contactError, canonicalContact } from '../domain/pharmacy-contacts';

export function PharmacyContactsEditor({ values, onChange, disabled = false, attempted = false, readOnly = false }: { values: string[]; onChange: (values: string[]) => void; disabled?: boolean; attempted?: boolean; readOnly?: boolean }) {
  const [touched, setTouched] = useState<Record<number, boolean>>({});
  return <View style={{ gap: 14 }}><Text style={s.heading}>Contact numbers *</Text>
    {values.map((value, index) => { const duplicate = value.trim() && values.slice(0, index).some(previous => canonicalContact(previous) === canonicalContact(value)); const error = contactError(value) || (duplicate ? 'This number is already listed.' : ''); return <View key={index} style={{ gap: 8 }}>
      <CheckoutField label={index === 0 ? 'Primary mobile number' : `Additional mobile number ${index}`} value={value} placeholder="09123456789 or +639123456789" keyboardType="phone-pad" editable={!disabled && !readOnly} maxLength={30} onBlur={() => setTouched(previous => ({ ...previous, [index]: true }))} onChangeText={text => { setTouched(previous => ({ ...previous, [index]: true })); onChange(values.map((item, i) => i === index ? text : item)); }} error={!readOnly && (attempted || touched[index]) ? error || undefined : undefined} />
      {!readOnly && index > 0 && <Button title="Remove number" secondary disabled={disabled} onPress={() => onChange(values.filter((_, i) => i !== index))} />}
    </View>; })}
    {!readOnly && values.length < 5 && <Button title="Add contact number" secondary icon="plus" disabled={disabled} onPress={() => onChange([...values, ''])} />}
  </View>;
}
