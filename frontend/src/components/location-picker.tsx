import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { detectCdoLocation } from '../api/device-location';
import { searchPlaces, listedPlaces } from '../api/places';
import { type Place } from '../domain/places';
import { useLocation } from '../state/location';
import { Button, Text, colors, s } from './ui';
import { Icon } from './icon';
import { AreaMap } from './area-map';

export function LocationPicker({ onDark = false }: { onDark?: boolean }) {
  const { area, setArea } = useLocation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [preview, setPreview] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const detectionId = useRef(0);
  const [issue, setIssue] = useState('');
  const request = useRef<AbortController | null>(null);
  const local = listedPlaces(draft);
  const choices = [...new Map([...local, ...results].map(place => [place.label.toLowerCase(), place])).values()];
  useEffect(() => () => { request.current?.abort(); detectionId.current++; }, []);
  function changeDraft(value: string) {
    detectionId.current++; setDetecting(false);
    request.current?.abort(); request.current = null;
    setBusy(false); setResults([]); setIssue(''); setPreview(null); setDraft(value);
  }
  function close() { detectionId.current++; setDetecting(false); request.current?.abort(); request.current = null; setBusy(false); setOpen(false); }
  async function findOnline() {
    if (draft.trim().length < 3 || busy) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setIssue('');
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const matches = await searchPlaces(draft, controller.signal);
      if (request.current === controller && !controller.signal.aborted) {
        setResults(matches);
        if (!matches.length) setIssue('No matching locations within Cagayan de Oro. Try a CDO barangay or street.');
      }
    } catch (error) {
      if (request.current === controller) setIssue(controller.signal.aborted ? 'Location search timed out. Try again.' : error instanceof Error ? error.message : 'Location search is unavailable.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  async function useDeviceLocation() {
    if (detecting) return;
    request.current?.abort(); request.current = null; setBusy(false); setIssue('');
    const id = ++detectionId.current; setDetecting(true);
    try {
      const place = await detectCdoLocation();
      if (id === detectionId.current) { setPreview(place); setResults([]); }
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
        <Text accessibilityRole="header" style={s.title}>Change location</Text><Text style={s.muted}>Select any of Cagayan de Oro's 80 barangays, or type to filter the list. Locations outside the city are excluded. This does not change your delivery address.</Text>
        <Button title={detecting ? 'Detecting location...' : 'Use my location'} secondary disabled={detecting} onPress={useDeviceLocation} />
        <Text style={s.caption}>Asks for permission when tapped. Your detected position is previewed on OpenStreetMap for confirmation.</Text>
        <TextInput accessibilityLabel="City, barangay, or street" autoFocus value={draft} onChangeText={changeDraft} maxLength={120} placeholder="e.g. Carmen, Cagayan de Oro City" returnKeyType="search" onSubmitEditing={findOnline} style={[s.input, { flex: undefined, borderWidth: 1, borderColor: '#AEBFB7', borderRadius: 8, paddingHorizontal: 12 }]} />
        <Text style={s.caption}>CAGAYAN DE ORO LOCATIONS</Text>
        {choices.length === 0 && <Text style={s.muted}>No listed CDO matches. You can search for another place within Cagayan de Oro below.</Text>}
        {busy && <Text accessibilityLiveRegion="polite" style={s.muted}>Finding location...</Text>}
        {!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}
        <Text style={s.caption}>{choices.length} matching locations - All 80 barangays are listed</Text>
        <ScrollView style={{ maxHeight: 230 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">{choices.map(place => <Pressable key={place.id} accessibilityRole="button" accessibilityState={{ selected: preview?.id === place.id }} onPress={() => { detectionId.current++; setDetecting(false); request.current?.abort(); request.current = null; setBusy(false); setPreview(place); }} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: preview?.id === place.id ? colors.teal : colors.line, backgroundColor: preview?.id === place.id ? colors.pale : colors.white, gap: 4 }}><Text style={s.text}>{place.label}</Text><Text style={s.caption}>{place.description}</Text></Pressable>)}</ScrollView>
        <Button title={busy ? 'Searching online...' : 'Find a CDO street or place online'} secondary disabled={busy || draft.trim().length < 3} onPress={findOnline} />
        {preview?.id === 'device-location' && <Text style={s.muted}>{preview.description}</Text>}
        {preview && <AreaMap area={preview.label} point={preview} height={210} />}
        <Text style={s.caption}>All barangays are available immediately. Only places within Cagayan de Oro can be selected. The map needs an internet connection.</Text>
        <Text style={s.caption}>Sample pharmacy listings currently cover Cagayan de Oro City.</Text>
        <Button title="Use this location" disabled={!preview} onPress={apply} /><Button title="Cancel" secondary onPress={close} />
      </View></ScrollView></View>
    </Modal>
  </>;
}
