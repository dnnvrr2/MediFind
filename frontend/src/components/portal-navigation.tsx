import { Pressable, View, useWindowDimensions } from 'react-native';
import { Icon, type IconName } from './icon';
import { Text, colors } from './ui';

export type PortalDestination = {
  key: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
};

// Customer, rider, guest, and staff portals share the same navigation sizing.
export function PortalNavigation({ items }: { items: PortalDestination[] }) {
  const wide = useWindowDimensions().width >= 760;
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: wide ? 8 : 0, justifyContent: 'space-around' }}>
    {items.map(item => <Pressable key={item.key} accessibilityRole="tab" aria-selected={item.active} accessibilityState={{ selected: item.active }} onPress={item.onPress}
      style={({ pressed }) => ({ flex: wide ? undefined : 1, minWidth: 0, minHeight: wide ? 48 : 58, paddingHorizontal: wide ? 16 : 2, paddingVertical: 6, flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: wide ? 8 : 3, borderRadius: 8, backgroundColor: wide && item.active ? colors.pale : 'transparent', opacity: pressed ? 0.75 : 1 })}>
      <Icon name={item.icon} size={22} color={item.active ? colors.teal : colors.muted} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: item.active ? colors.teal : colors.muted, fontSize: wide ? 14 : 12, lineHeight: 18, fontWeight: '500', maxWidth: '100%', textAlign: 'center' }}>{item.label}</Text>
    </Pressable>)}
  </View>;
}
