import Svg, { Circle, Path } from 'react-native-svg';

type Props = { visible: boolean; color?: string; size?: number };

export function PasswordEyeIcon({ visible, color = '#087F76', size = 20 }: Props) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    {visible ? <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} /> : <Path d="m4 4 16 16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />}
  </Svg>;
}
