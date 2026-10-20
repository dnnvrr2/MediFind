import { Linking, View } from 'react-native';
import { destinationArea } from '../domain/destination-map';
import { validPoint, type MapPoint } from '../domain/places';
import { osmSearchUrl } from '../domain/maps';
import { AreaMap } from './area-map';
import { Button, Text, s } from './ui';

export function DestinationMap({ address, barangay, city, showAddressLink = true, tracking = false, verifiedPoint }: {
  address: string; barangay?: string; city?: string; showAddressLink?: boolean; tracking?: boolean; verifiedPoint?: MapPoint | null;
}) {
  const verified = validPoint(verifiedPoint);
  const destination = verified ? { area: address, point: verifiedPoint! } : destinationArea(address, barangay, city);
  return <View style={{ gap: 12 }}>
    {destination ? <AreaMap area={destination.area} point={destination.point} height={260}
      caption={verified ? 'Verified pharmacy location.' : tracking ? 'Approximate destination area. Live rider location is unavailable.' : 'Approximate area, not a verified address pin.'} />
      : <Text style={s.muted}>No verified map location for this address.</Text>}
    {showAddressLink && !!address.trim() && <Button title="Find address on OpenStreetMap" secondary icon="map-pin" onPress={() => Linking.openURL(osmSearchUrl(address))} />}
  </View>;
}
