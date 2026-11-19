import { useMemo, useRef, useState } from 'react';
import { Image, Linking, PanResponder, Platform, Pressable, View } from 'react-native';
import { mapPixel, offsetMapPoint, pointAtPixel, tileSize, visibleMapTiles } from '../domain/map-camera';
import type { MapPoint } from '../domain/places';
import { Icon, type IconName } from './icon';
import { Text, TextLink, colors, s } from './ui';

const defaultCenter = { lat: 8.48, lon: 124.65 };
const tileTemplate = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const panThreshold = 6;
const mapHeight = 330;

function MapControl({ label, icon, disabled = false, onPress }: {
  label: string; icon: IconName; disabled?: boolean; onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const showTooltip = Platform.OS === 'web' && (hovered || focused) && !disabled;
  return <View style={{ zIndex: showTooltip ? 1 : 0 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.line, borderRadius: 8,
        backgroundColor: disabled ? colors.neutral : pressed ? colors.pale : colors.white })}>
      <Icon name={icon} color={disabled ? colors.muted : colors.teal} />
    </Pressable>
    {showTooltip && <View aria-hidden pointerEvents="none" style={{ position: 'absolute', bottom: 50, left: 0,
      backgroundColor: colors.dark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text numberOfLines={1} style={[s.caption, { color: colors.white }]}>{label}</Text>
    </View>}
  </View>;
}

export function BranchPinMap({ pin, onPin }: { pin: MapPoint | null; onPin: (pin: MapPoint) => void }) {
  const [center, setCenter] = useState(pin ?? defaultCenter);
  const [zoom, setZoom] = useState(pin ? 17 : 14);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const camera = useRef({ center, zoom, width, loaded, onPin });
  camera.current = { center, zoom, width, loaded, onPin };
  const gestureStart = useRef({ center, zoom, x: 0, y: 0 });

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      gestureStart.current = {
        center: camera.current.center, zoom: camera.current.zoom,
        x: event.nativeEvent.locationX, y: event.nativeEvent.locationY,
      };
    },
    onPanResponderMove: (_, gesture) => {
      const start = gestureStart.current;
      if (Math.hypot(gesture.dx, gesture.dy) >= panThreshold) {
        setCenter(offsetMapPoint(start.center, start.zoom, -gesture.dx, -gesture.dy));
      }
    },
    onPanResponderRelease: (_, gesture) => {
      const start = gestureStart.current;
      if (Math.hypot(gesture.dx, gesture.dy) < panThreshold && camera.current.width && camera.current.loaded) {
        camera.current.onPin(offsetMapPoint(start.center, start.zoom, start.x - camera.current.width / 2, start.y - mapHeight / 2));
      }
    },
  }), []);

  const centerPixel = mapPixel(center, zoom);
  const origin = { x: centerPixel.x - width / 2, y: centerPixel.y - mapHeight / 2 };
  const pinPixel = pin ? mapPixel(pin, zoom) : null;
  const tiles = width ? visibleMapTiles(origin, width, mapHeight, zoom) : [];
  const keyboard = Platform.OS === 'web' ? { onKeyDown: (event: { key: string; preventDefault: () => void }) => {
    const offsets: Record<string, [number, number]> = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] };
    const offset = offsets[event.key];
    if (offset) { event.preventDefault(); setCenter(offsetMapPoint(center, zoom, ...offset)); }
    if (event.key === 'Enter' && loaded) { event.preventDefault(); onPin(center); }
  } } : {};
  return <View style={{ gap: 8 }}>
    <View {...responder.panHandlers} {...keyboard} tabIndex={Platform.OS === 'web' ? 0 : undefined}
      accessibilityLabel="Branch map. Tap or click to place a pin. Use arrow keys to pan and Enter to place a pin."
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={{ height: mapHeight, overflow: 'hidden', borderRadius: 8, backgroundColor: colors.neutral, ...(Platform.OS === 'web' ? { touchAction: 'none' as const } : {}) }}>
      <View pointerEvents="none" style={{ flex: 1 }}>
        {tiles.map(tile => <Image key={`${retry}/${zoom}/${tile.x}/${tile.y}`}
          source={{ uri: tileTemplate.replace('{z}', String(zoom)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y)),
            ...(Platform.OS !== 'web' ? { headers: { 'User-Agent': 'MediFind/0.1 Branch Map' } } : {}) }}
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
          fadeDuration={0} style={{ position: 'absolute', left: tile.left, top: tile.top, width: tileSize, height: tileSize }} />)}
        {pinPixel && <View style={{ position: 'absolute', left: pinPixel.x - origin.x - 15, top: pinPixel.y - origin.y - 30, backgroundColor: colors.white, borderRadius: 16 }}><Icon name="map-pin" size={30} color={colors.teal} /></View>}
      </View>
    </View>
    {failed && !loaded && <Text style={s.muted}>Map tiles could not be loaded.</Text>}
    <View style={[s.row, { justifyContent: 'center' }]}>
      <MapControl label="Zoom in" icon="plus" disabled={zoom >= 19} onPress={() => setZoom(zoom + 1)} />
      <MapControl label="Zoom out" icon="minus" disabled={zoom <= 5} onPress={() => setZoom(zoom - 1)} />
      <MapControl label="Pin map center" icon="map-pin" disabled={!loaded} onPress={() => onPin(pointAtPixel(centerPixel, zoom))} />
      {failed && !loaded && <MapControl label="Retry map" icon="refresh" onPress={() => { setFailed(false); setRetry(retry + 1); }} />}
    </View>
    <TextLink title="© OpenStreetMap contributors" onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')} />
  </View>;
}
