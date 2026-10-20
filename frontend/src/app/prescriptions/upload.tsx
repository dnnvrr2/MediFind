import { router } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { Page, Back, Card, Text, s } from '../../components/ui';
import { PrescriptionPicker } from '../../components/prescription-file';
export default function UploadPrescription() {
  const { create } = usePrescriptions();
  return <Page><Back title="Upload prescription" /><Card><Text style={s.heading}>Start with a readable file</Text><Text style={s.muted}>You can review the file before continuing. When signed in, it is stored privately with your account. This preview does not contact a pharmacy or provide pharmacist review.</Text><PrescriptionPicker onPick={file => { const result = create(file); if (result.ok) router.replace({ pathname: '/prescriptions/[id]', params: { id: result.record.id } }); }} /></Card></Page>;
}
