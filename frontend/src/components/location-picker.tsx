import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { detectCdoLocation } from '../api/device-location';
import { listedPlaces } from '../api/places';
import { type Place } from '../domain/places';
import { useLocation } from '../state/location';
import { Button, Text, colors, s } from './ui';
import { Icon } from './icon';

export function LocationPicker({ onDark = false }: { onDark?: boolean }) {
  const { area, setArea } = useLocation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState<Place | null>(null);
  const [detecting, setDetecting] = useState(false);
  const detectionId = useRef(0);
  const [issue, setIssue] = useState('');
  const choices = listedPlaces(draft);
  useEffect(() => () => { detectionId.current++; }, []);
  function changeDraft(value: string) {
    detectionId.current++; setDetecting(false);
    setIssue(''); setPreview(null); setDraft(value);
  }
  function close() { detectionId.current++; setDetecting(false); setOpen(false); }
  async function useDeviceLocation() {
    if (detecting) return;
    setIssue('');
    const id = ++detectionId.current; setDetecting(true);
    try {
      const place = await detectCdoLocation();
      if (id === detectionId.current) { setPreview(place); }
    } catch (error) {
      if (id === detectionId.current) setIssue(error instanceof Error ? error.message : 'Could not detect your location. Select your barangay manually.');
    } finally { if (id === detectionId.current) setDetecting(false); }
  }
  function apply() {
    if (!preview) return;
    setArea(preview.label, preview);
    close();
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Change location. Current area: ${area}`} onPress={() => { changeDraft(''); setOpen(true); }} style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: onDark ? '#438D83' : colors.line, backgroundColor: onDark ? '#075F56' : colors.white, opacity: pressed ? 0.8 : 1 })}>
      <Icon name="map-pin" size={16} color={onDark ? colors.white : colors.teal} />
      <Text style={{ flexShrink: 1, fontSize: 13, lineHeight: 20, fontWeight: '500', color: onDark ? colors.white : colors.dark }}>{area}</Text>
      <Text style={{ flexShrink: 0, fontSize: 13, lineHeight: 20, fontWeight: '500', color: onDark ? colors.white : colors.teal }}>Change</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#102D2780', justifyContent: 'center', padding: 20 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 540, alignSelf: 'center' }}><View accessibilityViewIsModal style={[s.card, { padding: 24, gap: 18 }]}>
        <Text accessibilityRole="header" style={s.title}>Change location</Text><Text style={s.muted}>Choose a Cagayan de Oro barangay or search below. Your delivery address stays unchanged.</Text>
        <Button title={detecting ? 'Detecting location...' : 'Use my location'} secondary disabled={detecting} onPress={useDeviceLocation} />
        <Text style={s.caption}>Location permission is requested only when tapped.</Text>
        <TextInput accessibilityLabel="Filter CDO locations" autoFocus value={draft} onChangeText={changeDraft} maxLength={120} placeholder="e.g. Carmen, Cagayan de Oro City" returnKeyType="done" style={[s.input, { flex: undefined, borderWidth: 1, borderColor: '#AEBFB7', borderRadius: 8, paddingHorizontal: 12 }]} />

        {choices.length === 0 && <Text style={s.muted}>No matches. Try another barangay name.</Text>}
        {!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}
        <Text style={s.caption}>{choices.length} locations</Text>
        <ScrollView style={{ maxHeight: 230 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">{choices.map(place => <Pressable key={place.id} accessibilityRole="button" accessibilityState={{ selected: preview?.id === place.id }} onPress={() => { detectionId.current++; setDetecting(false); setPreview(place); }} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: preview?.id === place.id ? colors.teal : colors.line, backgroundColor: preview?.id === place.id ? colors.pale : colors.white, gap: 4 }}><Text style={s.text}>{place.label}</Text><Text style={s.caption}>{place.description}</Text></Pressable>)}</ScrollView>
        {preview && <View style={{ gap: 4 }}><Text style={s.text}>{preview.label}</Text>{preview.id === 'device-location' && <Text style={s.caption}>{preview.description}</Text>}</View>}

        <Button title="Use this location" disabled={!preview} onPress={apply} /><Button title="Cancel" secondary onPress={close} />
      </View></ScrollView></View>
    </Modal>
  </>;
}
