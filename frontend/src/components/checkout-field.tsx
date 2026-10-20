import { forwardRef, useState, type ComponentRef } from 'react';
import { View, TextInput, Pressable, type TextInputProps } from 'react-native';
import { Text, colors, s } from './ui';
import { fontFamilies } from './typography';
import { PasswordEyeIcon } from './password-eye-icon';

type Props = TextInputProps & { label: string; error?: string; showPasswordToggle?: boolean };

export const CheckoutField = forwardRef<ComponentRef<typeof TextInput>, Props>(function CheckoutField({ label, error, style, showPasswordToggle = false, secureTextEntry, ...props }, ref) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const canTogglePassword = showPasswordToggle && !!secureTextEntry;
  return <View style={{ gap: 7 }}>
    <Text style={{ fontSize: 14, lineHeight: 22, fontWeight: '500' }}>{label}</Text>
    <View style={canTogglePassword ? { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: error ? colors.danger : '#AEBFB7', borderRadius: 8, backgroundColor: colors.white } : undefined}>
      <TextInput ref={ref} {...props} secureTextEntry={canTogglePassword ? !passwordVisible : secureTextEntry} accessibilityLabel={label} accessibilityHint={error} aria-invalid={!!error} placeholderTextColor={colors.muted}
        style={[{ fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24, color: colors.dark, borderWidth: 1, borderColor: error ? colors.danger : '#AEBFB7', borderRadius: 8, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 12, minHeight: 48, textAlignVertical: props.multiline ? 'top' : 'center' }, canTogglePassword && { flex: 1, minWidth: 0, borderWidth: 0, backgroundColor: 'transparent' }, style]} />
      {canTogglePassword && <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} accessibilityState={{ selected: passwordVisible }} onPress={() => setPasswordVisible(value => !value)} style={{ minWidth: 48, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}><PasswordEyeIcon visible={passwordVisible} color={colors.teal} /></Pressable>}
    </View>
    {!!error && <Text accessibilityLiveRegion="polite" style={[s.muted, { color: colors.danger }]}>{error}</Text>}
  </View>;
});
