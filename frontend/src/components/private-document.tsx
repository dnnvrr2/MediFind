import { useState } from 'react';
import { Image, Modal, Platform, ScrollView, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Button, Text, colors, s } from './ui';

export function PrivateDocument({ load, name, title = 'Open document' }: { load: () => Promise<Blob>; name: string; title?: string }) {
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const [image, setImage] = useState('');
  async function open() {
    setBusy(true); setIssue('');
    try {
      const blob = await load();
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
      if (blob.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(name)) { setImage(data); return; }
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Document sharing is not available on this device.');
        const uri = `${FileSystem.cacheDirectory}medifind-${Date.now()}.pdf`;
        try { await FileSystem.writeAsStringAsync(uri, data.split(',')[1], { encoding: FileSystem.EncodingType.Base64 }); await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Open prescription document' }); }
        finally { await FileSystem.deleteAsync(uri, { idempotent: true }); }
      }
    } catch (error) { setIssue(error instanceof Error ? error.message : 'Could not open the private document.'); } finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}><Button title={busy ? 'Opening...' : title} secondary disabled={busy} icon="prescription" onPress={() => void open()} />{!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}<Modal visible={!!image} onRequestClose={() => setImage('')}><View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 }}><Button title="Close document" secondary onPress={() => setImage('')} /><ScrollView><ScrollView horizontal><Image source={{ uri: image }} accessibilityLabel={name} resizeMode="contain" style={{ width: 1000, height: 1400 }} /></ScrollView></ScrollView></View></Modal></View>;
}
