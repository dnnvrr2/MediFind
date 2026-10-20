import { View } from 'react-native';
import { router } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { prescriptionLabels } from '../../domain/prescriptions';
import { orderTime } from '../../domain/orders';
import { Page, Text, Card, Button, Badge, s } from '../../components/ui';
import { Icon } from '../../components/icon';
export default function Prescriptions() {
  const { records, loading, syncIssue } = usePrescriptions();
  return <Page><View style={s.between}><View style={{ gap: 6 }}><Text accessibilityRole="header" style={s.title}>Prescriptions</Text><Text style={s.muted}>Your submitted files and review status.</Text></View><Button title="Upload prescription" icon="upload" onPress={() => router.push('/prescriptions/upload')} /></View>
    <Text style={s.caption}>Files are private to your account. Review outcomes in this preview are simulated; no pharmacist has reviewed these requests.</Text>{loading && <Text style={s.muted}>Loading saved prescriptions…</Text>}{!!syncIssue && <Text accessibilityRole="alert" style={{ color: '#9A5A00' }}>{syncIssue}</Text>}
    {!loading && !records.length ? <Card><Icon name="prescription" size={32} /><Text style={s.heading}>No prescriptions yet</Text><Text style={s.muted}>Choose a file, check it, and select a pharmacy for the simulated preview flow.</Text></Card> : records.map(record => <Card key={record.id}><View style={s.between}><Text style={s.heading}>{record.id}</Text><Badge text={prescriptionLabels[record.status]} warning={record.status === 'pending' || record.status === 'needs_clearer_photo'} neutral={record.status === 'draft' || record.status === 'rejected'} /></View><Text style={s.text}>{record.file.name}</Text><Text style={s.caption}>{orderTime(record.createdAt)}</Text><Button secondary title={record.status === 'draft' ? 'Continue draft' : 'View prescription'} onPress={() => router.push({ pathname: '/prescriptions/[id]', params: { id: record.id } })} /></Card>)}
  </Page>;
}
