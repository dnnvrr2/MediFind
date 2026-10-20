import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { emptyCartAsset, iconAssets } from './icon-assets';

export type IconName = keyof typeof iconAssets;

export function Icon({ name, size = 22, color = '#10796F' }: { name: IconName; size?: number; color?: string }) {
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <SvgXml xml={iconAssets[name].replace('color="#10796F"', `color="${color}"`)} width={size} height={size} />
    </View>
  );
}

export function EmptyCartIllustration() {
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ alignSelf: 'center' }}>
      <SvgXml xml={emptyCartAsset} width={200} height={150} />
    </View>
  );
}
