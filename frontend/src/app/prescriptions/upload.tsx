import { router } from 'expo-router';
import { usePrescriptions } from '../../state/prescriptions';
import { Page, Back, Card } from '../../components/ui';
import { PrescriptionPicker } from '../../components/prescription-file';
export default function UploadPrescription() {
  const { create } = usePrescriptions();
  return <Page><Back title="Upload prescription" /><Card><PrescriptionPicker onPick={file => { const result = create(file); if (result.ok) router.replace({ pathname: '/prescriptions/[id]', params: { id: result.record.id } }); }} /></Card></Page>;
}
