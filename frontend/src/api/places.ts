import { parsePlaces, validPoint, type Place } from '../domain/places';
import { filterListedPlaces } from '../domain/listed-places';

// Photon supports autocomplete; the public Nominatim service does not.
const endpoint = process.env.EXPO_PUBLIC_GEOCODER_URL || 'https://photon.komoot.io/api/';
const cache = new Map<string, Place[]>();
let lastRequest = 0;
const storedKey = 'medifind.place-results.v1';
let savedPlaces: Place[] = [];
let hydrated = false;

export function listedPlaces(query: string): Place[] {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(storedKey) || 'null');
      if (Array.isArray(stored?.places) && typeof stored.at === 'number' && Date.now() >= stored.at && Date.now() - stored.at < 7 * 86400000) savedPlaces = stored.places.filter((p: Place) => validPoint(p) && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.description === 'string').slice(0, 50);
    } catch { /* the bundled list works even if storage is unavailable */ }
  }
  return filterListedPlaces(query, savedPlaces);
}

function rememberPlaces(places: Place[]) {
  const unique = new Map<string, Place>();
  for (const place of [...places, ...savedPlaces]) if (!unique.has(place.label.toLowerCase())) unique.set(place.label.toLowerCase(), place);
  savedPlaces = [...unique.values()].slice(0, 50);
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(storedKey, JSON.stringify({ at: Date.now(), places: savedPlaces })); } catch { /* keep memory cache */ }
  }
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const key = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (key.length < 3) return [];
  if (cache.has(key)) return cache.get(key)!;
  const pause = Math.max(0, 1200 - (Date.now() - lastRequest));
  if (pause) await new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(new Error('Search cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, pause);
    signal.addEventListener('abort', cancel, { once: true });
  });
  if (signal.aborted) throw new Error('Search cancelled');
  lastRequest = Date.now();
  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}q=${encodeURIComponent(query.trim())}&limit=5&lang=en&bbox=124.43,8.18,124.84,8.57&lat=8.48&lon=124.65`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(response.status === 429 ? 'Location search is busy. Please wait and try again.' : 'Location search is unavailable. Try again or use a sample area.');
  const places = parsePlaces(await response.json());
  rememberPlaces(places);
  if (cache.size > 60) cache.delete(cache.keys().next().value!);
  cache.set(key, places);
  return places;
}
