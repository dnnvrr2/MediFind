import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useProfile } from '../../state/profile';
import { useCatalog, medicines } from '../../data/catalog';
import { Page, Back, Badge, Button, DetailRow, Text, colors, s } from '../../components/ui';
import { Icon } from '../../components/icon';

export default function MedicineDetails() {
  const { status: catalogStatus } = useCatalog();
  const { profile } = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = medicines.find(x => x.id === id);
  if (catalogStatus !== 'ready') return <Page><Back title="Medicine details" /><Text style={s.muted}>{catalogStatus === 'loading' ? 'Loading catalog...' : 'Catalog unavailable. Try again shortly.'}</Text></Page>;
  if (!m) return <Page><Back title="Medicine not found" /><Text style={s.muted}>This medicine is currently unavailable in the catalog.</Text><Button title="Browse medicines" onPress={() => router.replace('/search')} /></Page>;
  return <Page><Back title="Medicine details" />
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}><View style={{ width: 56, height: 64, borderRadius: 10, backgroundColor: colors.neutral, alignItems: 'center', justifyContent: 'center' }}><Icon name="medicine" size={32} color={colors.muted} /></View><View style={{ flex: 1, gap: 8 }}><Text style={s.title}>{m.name}</Text><Text style={s.text}>{m.strength} · {m.form}</Text><Badge text={m.prescription ? 'Prescription required' : 'Over the counter'} warning={m.prescription} neutral={!m.prescription} /></View></View>
    <View><DetailRow label="Generic name" value={m.generic} /><DetailRow label="Sold per" value={m.unit} /></View>
    {m.prescription && <View style={{ padding: 16, backgroundColor: '#FFF5E1', borderRadius: 8, flexDirection: 'row', gap: 12 }}><Icon name="prescription" color={colors.warning} /><View style={{ flex: 1, gap: 6 }}><Text style={{ fontWeight: '600' }}>Pharmacist review needed</Text><Text style={s.muted}>Submit a prescription to the pharmacy before ordering.</Text></View></View>}
    {m.prescription && <Button title={profile ? "Upload prescription" : "Sign in to upload a prescription"} icon="upload" onPress={() => router.push('/prescriptions/upload')} />}<Button title="Compare pharmacies" icon="pharmacy" onPress={() => router.push({ pathname: '/availability/[id]', params: { id: m.id } })} />
  </Page>;
}
