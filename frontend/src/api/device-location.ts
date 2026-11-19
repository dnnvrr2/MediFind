import * as Location from 'expo-location';
import { cdoBarangayAt } from '../domain/cdo';
import type { Place } from '../domain/places';

type DetectedAddress = { street: string; barangay: string };

async function reverseLookupAddress(point: { lat: number; lon: number }): Promise<string> {
  const url = new URL(process.env.EXPO_PUBLIC_REVERSE_GEOCODER_URL || 'https://photon.komoot.io/reverse');
  url.search = new URLSearchParams({ lat: String(point.lat), lon: String(point.lon), radius: '0.3', limit: '3' }).toString();
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const result = await response.json() as { features?: { properties?: Record<string, unknown> }[] };
    for (const { properties = {} } of result.features ?? []) {
      const text = (key: string) => typeof properties[key] === 'string' ? (properties[key] as string).trim() : '';
      const street = text('street') || (text('osm_key') === 'highway' ? text('name') : '');
      if (street) return [text('housenumber'), street].filter(Boolean).join(' ');
    }
  } catch { /* Keep location detection useful if address lookup is unavailable. */ }
  return '';
}

export async function detectCdoLocation(): Promise<Place & { barangay: string; street?: string }> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission was not granted. You can select your barangay manually.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Location detection timed out. Check location services or select your barangay manually.')), 20000); }),
    ]);
    const point = { lat: position.coords.latitude, lon: position.coords.longitude };
    const accuracy = position.coords.accuracy;
    if (accuracy == null || !Number.isFinite(accuracy) || accuracy > 1500) throw new Error('Your device location is too approximate. Enable precise location or select your barangay manually.');
    const barangay = cdoBarangayAt(point);
    if (!barangay) throw new Error('Your detected location is outside Cagayan de Oro City. Only CDO locations can be selected.');
    const street = await reverseLookupAddress(point);
    return { ...point, id: 'device-location', barangay: barangay.name, street, label: `${barangay.name}, Cagayan de Oro City`, description: `Detected location · Accuracy about ${Math.round(accuracy)} m. Confirm the barangay before using it.` };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Location is unavailable. Check device location services or select your barangay manually.');
  } finally { if (timer) clearTimeout(timer); }
}
