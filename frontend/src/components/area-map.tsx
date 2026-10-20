import { useLocation } from '../state/location';
import { type MapPoint } from '../domain/places';
import { Linking, View } from 'react-native';
import { osmAreaUrl, osmPointUrl } from '../domain/maps';
import { Button, Text, s } from './ui';

export function AreaMap({ area, height: _height = 230, point: explicitPoint }: { area: string; height?: number; point?: MapPoint | null }) {
  const location = useLocation();
  const point = explicitPoint !== undefined ? explicitPoint : location.area === area ? location.point : null;
  return <View style={{ gap: 10 }}><Text style={s.muted}>Explore {area} on OpenStreetMap.</Text><Button title="Open OpenStreetMap" secondary onPress={() => Linking.openURL(point ? osmPointUrl(point) : osmAreaUrl(area))} /><Text style={s.caption}>© OpenStreetMap contributors · Area overview, not a pharmacy pin.</Text></View>;
}
