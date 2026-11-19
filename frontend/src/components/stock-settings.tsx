import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, type StockSettings, type StockCsvUpload, type StockCsvPreview } from '../api/client';
import { useProfile } from '../state/profile';
import { stockFields, suggestStockMapping } from '../domain/stock-import';
import { Icon } from './icon';
import { Back, Badge, Button, Card, Page, Text, colors, s } from './ui';

const inventory = () => router.replace({ pathname: '/partner', params: { tab: 'inventory' } });
const dateLabel = (value: string) => new Date(value).toLocaleString('en-PH');

async function downloadCsv(name: string, content: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
    const path = `${FileSystem.cacheDirectory}medifind-stock-${Date.now()}.csv`;
    try { await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 }); await Sharing.shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Save stock CSV' }); }
    finally { await FileSystem.deleteAsync(path, { idempotent: true }); }
  }
}

function ColumnMatch({ field, value, headers, sample, disabled, onChange }: { field: string; value: string; headers: string[]; sample: Record<string, string>; disabled: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 6 }}>
    <Text style={s.link}>{field}</Text>
    <Button title={value || 'Not matched'} secondary disabled={disabled} onPress={() => setOpen(true)} />
    {!!value && <Text numberOfLines={2} style={s.caption}>First row: {sample[value] || '(empty)'}</Text>}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#00000066' }}>
        <View style={[s.card, { maxHeight: '85%', width: '100%', maxWidth: 600, alignSelf: 'center' }]}>
          <Text accessibilityRole="header" style={s.heading}>{field}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            {['', ...headers].map(column => <Pressable key={column || '__none'} accessibilityRole="radio" accessibilityState={{ checked: column === value }} onPress={() => { onChange(column); setOpen(false); }} style={[s.card, { padding: 14 }, column === value && { borderColor: colors.teal, backgroundColor: colors.pale }]}><Text style={s.text}>{column || 'Not matched'}</Text>{!!column && <Text numberOfLines={2} style={s.caption}>{sample[column] || '(empty)'}</Text>}</Pressable>)}
          </ScrollView>
          <Button title="Close" secondary onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </View>;
}

function StockSettingsContent() {
  const { import: importRequested } = useLocalSearchParams<{ import?: string }>();
  const [settings, setSettings] = useState<StockSettings | null>(null);
  const [method, setMethod] = useState<StockSettings['method']>('manual');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [upload, setUpload] = useState<StockCsvUpload | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<StockCsvPreview | null>(null);
  const [shownRows, setShownRows] = useState(30);
  const [showErrors, setShowErrors] = useState(false);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    api.pharmacyStockSettings().then(value => { if (alive) { setSettings(value); setMethod(value.method); } }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not load stock settings.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete this action.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function resetFile() { setUpload(null); setPreview(null); setMapping({}); setShownRows(30); setShowErrors(false); }
  async function chooseFile() {
    const chosen = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv', 'application/vnd.ms-excel'], multiple: false, copyToCacheDirectory: true, base64: false });
    if (chosen.canceled) return;
    const file = chosen.assets[0];
    if (!/\.csv$/i.test(file.name)) throw new Error('Choose a .csv file exported as UTF-8.');
    if (file.size && file.size > 2 * 1024 * 1024) throw new Error('CSV files must be 2 MB or smaller.');
    const value = await api.pharmacyUploadStockCsv({ uri: file.uri, name: file.name, mimeType: file.mimeType || 'text/csv' });
    setUpload(value); setPreview(null); setMapping(suggestStockMapping(value.headers, settings?.column_mapping || {})); setShowErrors(false); setShownRows(30);
  }
  async function makePreview() {
    if (!upload) return;
    const value = await api.pharmacyPreviewStockCsv(upload.id, mapping);
    setPreview(value); setShownRows(30); setShowErrors(value.error_count > 0);
  }
  async function confirm() {
    if (!preview) return;
    const value = await api.pharmacyConfirmStockCsv(preview.id, preview.version);
    setSettings(value.settings); resetFile();
    setNotice(`${value.imported} medicine stock records ${value.already_applied ? 'were already imported' : 'imported'}.`);
  }
  const rows = preview?.rows.filter(row => !showErrors || row.error) || [];
  const validMapping = !!mapping.stock && (!!mapping.medicine_id || !!mapping.name);
  const importOnly = importRequested === '1' && settings?.method === 'csv';

  return <Page scrollKey={preview ? 'stock-import-preview' : upload ? 'stock-import-mapping' : 'stock-settings'}>
    <Back title={preview ? 'Review stock changes' : upload ? 'Match CSV columns' : importOnly ? 'Import stock CSV' : 'Stock settings'} onBack={() => { if (busy) return; if (preview) { setPreview(null); setError(''); } else if (upload) { resetFile(); setError(''); } else inventory(); }} />
    {loading && <ActivityIndicator accessibilityLabel="Loading stock settings" color={colors.teal} />}
    {!!error && <Card><Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>{!loading && !upload && <Button title={settings ? 'Reload settings' : 'Retry'} secondary disabled={busy} onPress={() => setReload(v => v + 1)} />}</Card>}
    {!!notice && <Card><Text accessibilityRole="alert" style={s.text}>{notice}</Text></Card>}
    {settings && !loading && <>
      {!upload && <>
        {!importOnly && <Card>
          <Text style={s.heading}>Stock update method</Text>
          {([{ key: 'manual', title: 'Manual updates', detail: 'Enter stock and price changes in MediFind.' }, { key: 'csv', title: 'CSV imports', detail: 'Upload stock counts from a spreadsheet or pharmacy system.' }] as const).map(option => <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ checked: method === option.key, disabled: busy || !settings.can_configure }} disabled={busy || !settings.can_configure} onPress={() => setMethod(option.key)} style={[s.card, { padding: 16 }, method === option.key && { backgroundColor: colors.pale, borderColor: colors.teal }]}><View style={s.between}><Text style={s.heading}>{option.title}</Text>{method === option.key && <Icon name="check" size={20} />}</View><Text style={s.muted}>{option.detail}</Text></Pressable>)}
          <Pressable accessibilityRole="link" accessibilityLabel="POS system: contact admin" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => router.push({ pathname: '/partner/contact-admin', params: { tab: 'inventory' } })} style={({ pressed }) => [s.card, { padding: 16 }, pressed && { opacity: 0.75 }]}>
            <View style={s.between}><Text style={s.heading}>POS system</Text><View style={s.row}><Badge text="Setup required" neutral /><Icon name="arrow-right" size={20} /></View></View>
            <Text style={s.muted}>Contact admin to establish a connection.</Text>
          </Pressable>
          {settings.can_configure ? <Button title={busy ? 'Saving...' : 'Save method'} disabled={busy || method === settings.method} onPress={() => void run(async () => { const value = await api.pharmacySaveStockSettings({ method, version: settings.version }); setSettings(value); setNotice('Stock update method saved.'); })} /> : <Text style={s.muted}>The branch owner chooses the stock update method.</Text>}
          <Text style={s.caption}>Manual corrections remain available with CSV imports.</Text>
        </Card>}
        {method === 'csv' && settings.method !== 'csv' && <Card><Text style={s.muted}>Save CSV imports as the method to enable uploads.</Text></Card>}
        {settings.method === 'csv' && <Card>
          <Text style={s.heading}>{importRequested === '1' ? 'Import stock CSV' : 'CSV imports'}</Text>

          <Text style={s.text}>Stock is the total physical quantity, including reserved units. Imports replace counts; they do not add quantities.</Text>
          <Text style={s.muted}>UTF-8 CSV · Up to 2 MB and 1,000 rows. Only approved medicines in this branch can be updated.</Text>
          <Button title={busy ? 'Please wait...' : 'Import CSV'} icon="upload" disabled={busy || method !== settings.method} onPress={() => void run(chooseFile)} />
          <Button title="Download stock template" secondary icon="medicine" disabled={busy} onPress={() => void run(async () => { const file = await api.pharmacyStockTemplate(); await downloadCsv(file.filename, file.content); if (!file.count) setNotice('The template has headers only. Request medicines and wait for approval before importing stock.'); })} />
          <Text style={s.caption}>The template includes approved medicine IDs and current counts. CSV uploads are manual; changes appear after confirmation.</Text>
          <Text style={s.muted}>{settings.last_import ? `Last imported: ${dateLabel(settings.last_import.at)}` : 'No CSV imports yet.'}</Text>
        </Card>}
        {!!settings.history.length && <Card><Text style={s.heading}>Recent imports</Text>{settings.history.map(item => <View key={item.id} style={{ gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line }}><Text style={s.text}>{item.filename}</Text><Text style={s.muted}>{item.rows} medicines · {dateLabel(item.at)}</Text><Text style={s.caption}>{item.actor}</Text></View>)}</Card>}
      </>}
      {upload && !preview && <>
        <Card><Text style={s.heading}>{upload.filename}</Text><Badge text={`${upload.row_count} rows`} /><Text style={s.muted}>Match physical stock and either medicine ID or medicine name. Use strength, form, and unit to distinguish medicines with the same name.</Text><Text style={s.caption}>Unmatched optional columns keep existing values. Price is required when creating a medicine's first inventory record.</Text></Card>
        <Card><Text style={s.heading}>Column matching</Text>{stockFields.map(field => <ColumnMatch key={field.key} field={field.label} value={mapping[field.key] || ''} headers={upload.headers} sample={upload.sample[0] || {}} disabled={busy} onChange={value => { setMapping(previous => ({ ...previous, [field.key]: value })); setError(''); }} />)}
          {settings.can_configure && <Button title="Save column matching" secondary disabled={busy || !validMapping} onPress={() => void run(async () => { const value = await api.pharmacySaveStockSettings({ method: 'csv', version: settings.version, column_mapping: mapping }); setSettings(value); setNotice('Column matching saved for future uploads.'); })} />}
          <Button title={busy ? 'Preparing preview...' : 'Preview changes'} disabled={busy || !validMapping} onPress={() => void run(makePreview)} />
          <Button title="Choose another file" secondary disabled={busy} onPress={() => void run(chooseFile)} />
        </Card>
      </>}
      {upload && preview && <>
        <Card><Text style={s.heading}>{preview.filename}</Text><View style={s.row}><Badge text={`${preview.valid_count} valid`} /><Badge text={`${preview.error_count} errors`} warning={preview.error_count > 0} /></View><Text style={s.text}>Physical counts, prices, thresholds, and availability shown below replace the matched records. Medicines absent from this file stay unchanged.</Text><Text style={s.muted}>Nothing changes until you confirm. Fix every error before importing. Preview expires at {dateLabel(preview.expires_at)}.</Text><View style={s.row}><Button title="All rows" secondary={showErrors} disabled={busy} onPress={() => { setShowErrors(false); setShownRows(30); }} /><Button title="Errors only" secondary={!showErrors} disabled={busy} onPress={() => { setShowErrors(true); setShownRows(30); }} /></View></Card>
        {rows.slice(0, shownRows).map(row => <Card key={row.row}><View style={s.between}><Text style={[s.heading, { flexShrink: 1 }]}>{row.medicine}</Text><Badge text={`Row ${row.row}`} neutral /></View>{row.error ? <Text style={{ color: colors.danger }}>{row.error}</Text> : <><Text style={s.text}>Physical stock: {row.old_stock ?? 'Not set'} → {row.stock}</Text><Text style={s.muted}>Reserved: {row.reserved} · Available after import: {row.available_stock}</Text><Text style={s.text}>Price: ₱{row.old_price ?? 'Not set'} → ₱{row.price}</Text><Text style={s.muted}>Low stock threshold: {row.low_stock} · {row.available ? 'Available for sale' : 'Unavailable for sale'}</Text></>}</Card>)}
        {!rows.length && <Card><Text style={s.muted}>No rows in this view.</Text></Card>}
        {rows.length > shownRows && <Button title={`Show more (${rows.length - shownRows} remaining)`} secondary disabled={busy} onPress={() => setShownRows(n => n + 30)} />}
        <Card><Button title={busy ? 'Importing...' : `Confirm import (${preview.valid_count} medicines)`} icon="check" disabled={busy || preview.error_count > 0 || !preview.valid_count} onPress={() => void run(confirm)} /><Button title="Refresh preview" secondary icon="refresh" disabled={busy} onPress={() => void run(makePreview)} /><Button title="Edit column matching" secondary disabled={busy} onPress={() => { setPreview(null); setError(''); }} /><Button title="Replace file" secondary disabled={busy} onPress={() => void run(chooseFile)} /><Button title="Cancel import" secondary disabled={busy} onPress={() => { resetFile(); setError(''); }} /></Card>
      </>}
    </>}
  </Page>;
}

export function StockSettingsScreen() {
  const { profile, ready } = useProfile();
  if (!ready) return <Page><ActivityIndicator accessibilityLabel="Loading account" color={colors.teal} /></Page>;
  if (!profile) return <Page><Card><Text style={s.heading}>Sign in to your pharmacy account</Text><Button title="Sign in" onPress={() => router.replace({ pathname: '/account/sign-in', params: { returnTo: '/partner/stock-settings?tab=inventory' } })} /></Card></Page>;
  return <StockSettingsContent key={profile.id ?? profile.email} />;
}
