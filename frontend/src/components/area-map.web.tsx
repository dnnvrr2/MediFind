import { useLocation } from '../state/location';
import { type MapPoint } from '../domain/places';
import { createElement, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { areaViewport, osmAreaUrl, osmEmbedUrl, pointViewport, osmPointUrl } from '../domain/maps';
import { Button, Text, TextLink, colors, s } from './ui';

export function AreaMap({ area, height = 230, point: explicitPoint, caption = 'Area map - Pharmacy pins are unverified.' }: { area: string; height?: number; point?: MapPoint | null; caption?: string }) {
  const location = useLocation();
  const point = explicitPoint !== undefined ? explicitPoint : location.area === area ? location.point : null;
  const viewport = point ? pointViewport(point) : areaViewport(area);
  const url = viewport ? osmEmbedUrl(viewport, point) : null;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => { setFailed(false); setLoaded(false); }, [url, reload]);
  useEffect(() => {
    if (!url || loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), 20000);
    return () => clearTimeout(timer);
  }, [url, loaded, failed, reload]);
  return <View style={{ gap: 8 }}>
    {url && !failed ? <View style={{ height, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.neutral }}>
      {createElement('iframe', {
        key: `${url}:${reload}`, src: url, title: `OpenStreetMap area overview: ${area}`, loading: 'eager',
        referrerPolicy: 'strict-origin-when-cross-origin',
        style: { width: '100%', height: '100%', border: 0, display: 'block' },
        onLoad: () => setLoaded(true), onError: () => setFailed(true),
      })}
    </View> : <View style={{ padding: 16, gap: 10, backgroundColor: colors.neutral, borderRadius: 10 }}>
      <Text style={s.muted}>{failed ? 'Map unavailable. Retry or open OpenStreetMap.' : 'Open this area in OpenStreetMap.'}</Text>
      {failed && <Button title="Retry map" secondary onPress={() => setReload(value => value + 1)} />}
    </View>}
    <Text style={s.caption}>{caption}</Text>
    <View style={s.between}><TextLink title="© OpenStreetMap contributors" onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')} /><TextLink title="Open larger map" onPress={() => Linking.openURL(point ? osmPointUrl(point) : osmAreaUrl(area))} /></View>
  </View>;
}
