import React, { useContext } from 'react';
import { Pressable, StyleSheet, View, ScrollView, TextInput, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from './icon';
import { FontsReady, fontFamilies, Text } from './typography';
export { Text } from './typography';

export const colors = {
  teal: '#10796F', dark: '#202D2B', muted: '#596762', bg: '#F7F9F8', line: '#DFE6E2',
  pale: '#E8F3EF', white: '#FFFFFF', danger: '#A3312A', warning: '#805B14', neutral: '#EFF2F0',
};

export const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingTop: 24, paddingBottom: 36, gap: 24 },
  card: { backgroundColor: colors.white, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.line, gap: 16 },
  list: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden' },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.dark, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.dark },
  text: { fontSize: 16, lineHeight: 24, color: colors.dark },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted, fontWeight: '500' },
  price: { fontSize: 18, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'], color: colors.dark },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 80, minHeight: 50, fontSize: 16, lineHeight: 24, paddingVertical: 12, color: colors.dark, fontFamily: fontFamilies.regular },
  button: { minHeight: 48, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal, flexDirection: 'row', gap: 8 },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 15, lineHeight: 24, flexShrink: 1 },
  link: { color: colors.teal, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  divider: { borderBottomWidth: 1, borderColor: colors.line },
});

export function Page({ children, sectionGap, scrollRef }: React.PropsWithChildren<{ sectionGap?: number; scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>> }>) {
  const wide = useWindowDimensions().width >= 760;
  return <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={[s.page, wide && { paddingTop: 36, gap: 28 }, sectionGap !== undefined && { gap: sectionGap }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

export function Card({ children }: React.PropsWithChildren) { return <View style={s.card}>{children}</View>; }

export function Button({ title, onPress, disabled = false, secondary = false, icon }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; icon?: IconName;
}) {
  return (
    <Pressable accessibilityRole="button" aria-disabled={disabled} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.button, secondary && { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, disabled && { backgroundColor: '#E3E8E5' }, pressed && { opacity: 0.75 }]}>
      {icon && <Icon name={icon} size={20} color={disabled ? colors.muted : secondary ? colors.teal : colors.white} />}
      <Text style={[s.buttonText, (secondary || disabled) && { color: disabled ? colors.muted : colors.teal, flexShrink: 1 }]}>{title}</Text>
    </Pressable>
  );
}

export function TextLink({ title, onPress, icon }: { title: string; onPress: () => void; icon?: IconName }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}>
    <Text style={[s.link, { flexShrink: 1 }]}>{title}</Text>{icon && <Icon name={icon} size={18} />}
  </Pressable>;
}

export function Badge({ text, warning = false, neutral = false }: { text: string; warning?: boolean; neutral?: boolean }) {
  return <View style={{ backgroundColor: neutral ? colors.neutral : warning ? '#FFF3DA' : colors.pale, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5, alignSelf: 'flex-start', maxWidth: '100%' }}>
    <Text style={{ color: neutral ? colors.muted : warning ? colors.warning : colors.teal, fontSize: 12, lineHeight: 18, fontWeight: '500' }}>{text}</Text>
  </View>;
}

export function Back({ title, onBack }: { title: string; onBack?: () => void }) {
  return <View style={{ gap: 6 }}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'))} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, alignSelf: 'flex-start', paddingRight: 16 }}>
    <Icon name="back" size={20} color={colors.muted} /><Text style={s.muted}>Back</Text>
  </Pressable><Text accessibilityRole="header" style={s.title}>{title}</Text></View>;
}

export function Search({ value, onChange, onSubmit, inline = false }: { value: string; onChange: (value: string) => void; onSubmit: () => void; inline?: boolean }) {
  const fontsReady = useContext(FontsReady);
  return <View style={{ gap: 10, flexDirection: inline ? 'row' : 'column', alignItems: 'stretch' }}><View style={{ flex: inline ? 1 : undefined, minWidth: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: '#AEBFB7', borderRadius: 8, gap: 10, paddingLeft: 14 }}>
    <Icon name="search" color={colors.muted} />
    <TextInput accessibilityLabel="Search medicine name, strength, or form" placeholder="Medicine name or generic" placeholderTextColor={colors.muted} value={value} onChangeText={onChange} onSubmitEditing={onSubmit} returnKeyType="search" style={[s.input, !fontsReady && { fontFamily: undefined }]} autoCorrect={false} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} style={{ minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} color={colors.muted} /></Pressable>}
    {!value && <View style={{ width: 12 }} />}
  </View><Button title={inline ? "Search" : "Search medicines"} onPress={onSubmit} /></View>;
}

export function Quantity({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, alignSelf: 'flex-start' }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" disabled={value <= 1} accessibilityState={{ disabled: value <= 1 }} onPress={() => onChange(value - 1)} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', opacity: value <= 1 ? 0.35 : 1 }}><Icon name="minus" size={18} color={colors.dark} /></Pressable>
    <Text accessibilityLabel={`Quantity ${value}`} style={{ minWidth: 32, textAlign: 'center', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" disabled={value >= max} accessibilityState={{ disabled: value >= max }} onPress={() => onChange(value + 1)} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', opacity: value >= max ? 0.35 : 1 }}><Icon name="plus" size={18} color={colors.dark} /></Pressable>
  </View>;
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  const narrow = useWindowDimensions().width < 380;
  return <View style={{ flexDirection: narrow ? 'column' : 'row', justifyContent: 'space-between', gap: narrow ? 3 : 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line }}>
    <Text style={[s.muted, { flexShrink: 0 }]}>{label}</Text><Text style={[s.text, { flex: narrow ? undefined : 1, textAlign: narrow ? 'left' : 'right' }]}>{value}</Text>
  </View>;
}
