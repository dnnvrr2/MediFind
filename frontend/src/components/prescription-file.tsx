import { useRef, useState } from 'react';
import { Image, Linking, Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { fileIssue, type PrescriptionFile } from '../domain/prescriptions';
import { Button, Card, Text, TextLink, s, colors } from './ui';

export function FilePreview({ file }: { file: PrescriptionFile }) {
  const [failed, setFailed] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [ratio, setRatio] = useState(0.75);
  const { width } = useWindowDimensions();
  const imageWidth = Math.max(720, Math.min(width - 48, 1100));
  if (file.uri.startsWith('remote:')) return <View style={{ backgroundColor: colors.neutral, padding: 20, gap: 8, borderRadius: 8 }}><Text style={s.heading}>File saved securely</Text><Text style={s.muted}>{file.name} is stored with your account. The app does not expose a public file link.</Text></View>;
  return <View style={{ gap: 10 }}>
    {file.mimeType.startsWith('image/') && !failed ? <Image key={file.uri} source={{ uri: file.uri }} accessibilityLabel="Selected prescription file preview" resizeMode="contain" style={{ width: '100%', height: 240, backgroundColor: colors.neutral, borderRadius: 8 }} onError={() => setFailed(true)} /> : <View style={{ backgroundColor: colors.neutral, padding: 20, gap: 8, borderRadius: 8 }}><Text style={s.heading}>{file.mimeType === 'application/pdf' ? 'PDF document' : 'Image preview unavailable'}</Text><Text style={s.muted}>{file.mimeType === 'application/pdf' ? 'Open the selected PDF to inspect every page before continuing.' : 'Replace the file if it cannot be opened.'}</Text></View>}
    <Text style={{ fontWeight: '600' }}>{file.name}</Text><Text style={s.caption}>{(file.size / 1024 / 1024).toFixed(2)} MB · Selected locally</Text>
    {file.mimeType.startsWith('image/') && !failed && <TextLink title="View full image" onPress={() => { Image.getSize(file.uri, (w, h) => setRatio(w / h), () => setFailed(true)); setEnlarged(true); }} />}
    {file.mimeType === 'application/pdf' && <TextLink title="Open selected PDF" onPress={() => { Linking.openURL(file.uri).catch(() => setFailed(true)); }} />}
    {failed && <Text accessibilityRole="alert" style={{ color: colors.danger }}>Could not preview or open this file. Choose a readable replacement.</Text>}
    <Modal visible={enlarged} animationType="none" onRequestClose={() => setEnlarged(false)}><View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, gap: 16 }}><Button title="Close full image" secondary onPress={() => setEnlarged(false)} /><Text style={s.caption}>Scroll horizontally and vertically to inspect the whole image.</Text><ScrollView><ScrollView horizontal><Image source={{ uri: file.uri }} accessibilityLabel="Full prescription file image" resizeMode="contain" style={{ width: imageWidth, height: imageWidth / ratio }} /></ScrollView></ScrollView></View></Modal>
  </View>;
}
export function PrescriptionPicker({ onPick, replacement = false }: { onPick: (file: PrescriptionFile) => void; replacement?: boolean }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  async function pick(camera: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      let file: PrescriptionFile;
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError('Camera permission was denied. Choose a file instead, or enable the camera in device settings.'); return; }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
        if (result.canceled) return;
        const asset = result.assets[0];
        file = { uri: asset.uri, name: asset.fileName ?? 'Prescription.jpg', mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? 0 };
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], multiple: false, copyToCacheDirectory: true, base64: false });
        if (result.canceled) return;
        const asset = result.assets[0];
        file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? (/\.pdf$/i.test(asset.name) ? 'application/pdf' : /\.png$/i.test(asset.name) ? 'image/png' : /\.jpe?g$/i.test(asset.name) ? 'image/jpeg' : ''), size: asset.size ?? 0 };
      }
      const issue = fileIssue(file);
      if (issue) setError(issue); else onPick(file);
    } catch { setError('The file could not be selected. Try again or choose another file.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View style={{ gap: 12 }}><Button title={busy ? 'Selecting file…' : replacement ? 'Replace file' : 'Choose prescription file'} icon="upload" disabled={busy} onPress={() => pick(false)} />
    {Platform.OS !== 'web' && <Button title={replacement ? 'Retake photo' : 'Take a photo'} secondary icon="camera" disabled={busy} onPress={() => pick(true)} />}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    <Text style={s.caption}>JPG, PNG, or PDF, up to 10 MB. When signed in, the file is uploaded to your private account storage; it is not sent to a pharmacy for real review.</Text>
  </View>;
}
