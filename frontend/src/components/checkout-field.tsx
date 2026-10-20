import { forwardRef, type ComponentRef } from 'react';
import { View, TextInput, type TextInputProps } from 'react-native';
import { Text, colors, s } from './ui';
import { fontFamilies } from './typography';

type Props = TextInputProps & { label: string; error?: string };

export const CheckoutField = forwardRef<ComponentRef<typeof TextInput>, Props>(function CheckoutField({ label, error, style, ...props }, ref) {
  return <View style={{ gap: 7 }}>
    <Text style={{ fontSize: 14, lineHeight: 22, fontWeight: '500' }}>{label}</Text>
    <TextInput ref={ref} {...props} accessibilityLabel={label} accessibilityHint={error} aria-invalid={!!error} placeholderTextColor={colors.muted}
      style={[{ fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24, color: colors.dark, borderWidth: 1, borderColor: error ? colors.danger : '#AEBFB7', borderRadius: 8, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 12, minHeight: 48, textAlignVertical: props.multiline ? 'top' : 'center' }, style]} />
    {!!error && <Text accessibilityLiveRegion="polite" style={[s.muted, { color: colors.danger }]}>{error}</Text>}
  </View>;
});
