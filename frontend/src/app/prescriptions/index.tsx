import { View } from 'react-native';
import { router } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { prescriptionLabel } from '../../domain/prescriptions';
import { orderTime } from '../../domain/orders';
import { Page, Text, Card, Button, Badge, s } from '../../components/ui';
import { Icon } from '../../components/icon';
export default function Prescriptions() {
  const { records, loading, syncIssue, retrySync } = usePrescriptions();
  return <Page><View style={s.between}><View style={{ gap: 6 }}><Text accessibilityRole="header" style={s.title}>Prescriptions</Text></View><Button title="Upload prescription" icon="upload" onPress={() => router.push('/prescriptions/upload')} /></View>
    <Text style={s.caption}>Files are private. Assigned pharmacies review submissions; sample reviews are labeled.</Text>{loading && <Text style={s.muted}>Loading saved prescriptions…</Text>}{!!syncIssue && <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: '#9A5A00' }}>{syncIssue}</Text><Button title="Retry sync" secondary onPress={() => void retrySync()} /></View>}
    {!loading && !records.length ? <Card><Icon name="prescription" size={32} /><Text style={s.heading}>No prescriptions yet</Text><Text style={s.muted}>Upload a prescription to get started.</Text></Card> : records.map(record => <Card key={record.id}><View style={s.between}><Text style={s.heading}>{record.id}</Text><Badge text={prescriptionLabel(record)} warning={record.status === 'pending' || record.status === 'needs_clearer_photo'} neutral={record.status === 'draft' || record.status === 'rejected'} /></View><Text style={s.text}>{record.file.name}</Text><Text style={s.caption}>{orderTime(record.createdAt)}</Text><Button secondary title={record.status === 'draft' ? 'Continue draft' : 'View prescription'} onPress={() => router.push({ pathname: '/prescriptions/[id]', params: { id: record.id } })} /></Card>)}
  </Page>;
}
