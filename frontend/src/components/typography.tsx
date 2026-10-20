import { createContext, useContext } from 'react';
import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';

export const FontsReady = createContext(false);
export const fontFamilies = {
  regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold',
};

// Select the actual font file rather than relying on synthesized native bold.
export function Text({ style, ...props }: TextProps) {
  const ready = useContext(FontsReady);
  const weight = StyleSheet.flatten(style)?.fontWeight ?? '400';
  const numeric = weight === 'bold' ? 700 : Number(weight) || 400;
  const family = numeric >= 700 ? fontFamilies.bold : numeric >= 600 ? fontFamilies.semibold : numeric >= 500 ? fontFamilies.medium : fontFamilies.regular;
  return <NativeText {...props} style={[{ fontSize: 16, lineHeight: 24, color: '#202D2B' }, style, ready && { fontFamily: family, fontWeight: 'normal' }]} />;
}
