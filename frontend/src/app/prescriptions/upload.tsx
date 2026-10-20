import { router } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { Page, Back, Card, Text, s } from '../../components/ui';
import { PrescriptionPicker } from '../../components/prescription-file';
export default function UploadPrescription() {
  const { create } = usePrescriptions();
  return <Page><Back title="Upload prescription" /><Card><Text style={s.muted}>Include only the prescription information needed for review. You can inspect the file before continuing.</Text><PrescriptionPicker onPick={file => { const result = create(file); if (result.ok) router.replace({ pathname: '/prescriptions/[id]', params: { id: result.record.id } }); }} /></Card></Page>;
}
