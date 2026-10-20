import * as Location from 'expo-location';
import { cdoBarangayAt } from '../domain/cdo';
import type { Place } from '../domain/places';

export async function detectCdoLocation(): Promise<Place> {
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
    return { ...point, id: 'device-location', label: `${barangay.name}, Cagayan de Oro City`, description: `Detected location · Accuracy about ${Math.round(accuracy)} m. Confirm the barangay before using it.` };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Location is unavailable. Check device location services or select your barangay manually.');
  } finally { if (timer) clearTimeout(timer); }
}
