import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { validPoint, type MapPoint } from '../domain/places';
import { insideCdo, isCdoAreaName } from '../domain/cdo';
import { defaultArea, normalizeArea } from '../domain/locations';

const storageKey = 'medifind.browse-area';
const Context = createContext<{ area: string; point: MapPoint | null; setArea: (value: string, point?: MapPoint) => void } | null>(null);

export function LocationProvider({ children }: PropsWithChildren) {
  const [area, setAreaState] = useState(defaultArea);
  const [point, setPoint] = useState<MapPoint | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { const saved = normalizeArea(window.sessionStorage.getItem(storageKey) || ''); if (saved) { const stored = JSON.parse(window.sessionStorage.getItem(storageKey + '.point') || 'null'); const storedPoint = stored?.area === saved && validPoint(stored.point) && insideCdo(stored.point) ? stored.point : null; if (storedPoint || isCdoAreaName(saved)) { setAreaState(saved); setPoint(storedPoint); } } } catch { /* browsing still works with restricted storage */ }
    }
  }, []);
  function setArea(value: string, selectedPoint?: MapPoint) {
    const next = normalizeArea(value);
    if (!next || (selectedPoint ? !validPoint(selectedPoint) || !insideCdo(selectedPoint) : !isCdoAreaName(next))) return;
    setAreaState(next);
    const nextPoint = validPoint(selectedPoint) ? selectedPoint : null;
    setPoint(nextPoint);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.sessionStorage.setItem(storageKey, next); window.sessionStorage.setItem(storageKey + '.point', JSON.stringify({ area: next, point: nextPoint })); } catch { /* keep the in-memory selection */ }
    }
  }
  return <Context.Provider value={{ area, point, setArea }}>{children}</Context.Provider>;
}

export function useLocation() {
  const context = useContext(Context);
  if (!context) throw new Error('LocationProvider missing');
  return context;
}
