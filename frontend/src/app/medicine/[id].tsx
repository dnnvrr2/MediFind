import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useProfile } from '../../state/profile';
import { useCatalog, medicines } from '../../data/catalog';
import { Page, Back, Badge, Button, DetailRow, Text, colors, s } from '../../components/ui';
import { Icon } from '../../components/icon';

export default function MedicineDetails() {
  useCatalog();
  const { profile } = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = medicines.find(x => x.id === id);
  if (!m) return <Page><Back title="Medicine not found" /><Text style={s.muted}>This medicine is currently unavailable in the catalog.</Text><Button title="Browse medicines" onPress={() => router.replace('/search')} /></Page>;
  return <Page><Back title="Medicine details" />
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}><View style={{ width: 56, height: 64, borderRadius: 10, backgroundColor: colors.neutral, alignItems: 'center', justifyContent: 'center' }}><Icon name="medicine" size={32} color={colors.muted} /></View><View style={{ flex: 1, gap: 8 }}><Text style={s.title}>{m.name}</Text><Text style={s.text}>{m.strength} · {m.form}</Text><Badge text={m.prescription ? 'Prescription required' : 'Over the counter'} warning={m.prescription} neutral={!m.prescription} /></View></View>
    <View><DetailRow label="Generic name" value={m.generic} /><DetailRow label="Category" value={m.category} /><DetailRow label="Sold per" value={m.unit} /></View>
    <View style={{ gap: 10 }}><Text style={s.heading}>About this listing</Text><Text style={s.text}>{m.description}</Text><Text style={s.muted}>Ask a pharmacist about suitability and directions.</Text></View>
    {m.prescription && <View style={{ padding: 16, backgroundColor: '#FFF5E1', borderRadius: 8, flexDirection: 'row', gap: 12 }}><Icon name="prescription" color={colors.warning} /><View style={{ flex: 1, gap: 6 }}><Text style={{ fontWeight: '600' }}>Pharmacist review needed</Text><Text style={s.muted}>{m.live ? 'Submit a prescription to the pharmacy for pharmacist review before ordering.' : 'Upload a prescription for simulated review. This is not medical approval.'}</Text></View></View>}
    {m.prescription && <Button title={profile ? "Upload prescription" : "Sign in to upload a prescription"} icon="upload" onPress={() => router.push('/prescriptions/upload')} />}<Button title="Compare pharmacies" icon="pharmacy" onPress={() => router.push({ pathname: '/availability/[id]', params: { id: m.id } })} />
  </Page>;
}
