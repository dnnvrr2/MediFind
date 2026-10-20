import { router } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { Page, Back, Card, Text, s } from '../../components/ui';
import { PrescriptionPicker } from '../../components/prescription-file';
export default function UploadPrescription() {
  const { create } = usePrescriptions();
  return <Page><Back title="Upload prescription" /><Card><Text style={s.heading}>Before you upload</Text><Text style={s.muted}>Your file is saved privately to your account and accessible through an authenticated service. Include only the prescription information needed for review. You can inspect the file before continuing. This preview does not contact a pharmacy or provide pharmacist review. Read Privacy below for details.</Text><PrescriptionPicker onPick={file => { const result = create(file); if (result.ok) router.replace({ pathname: '/prescriptions/[id]', params: { id: result.record.id } }); }} /></Card></Page>;
}
