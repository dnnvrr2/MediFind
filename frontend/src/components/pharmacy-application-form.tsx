import { useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, type PharmacyApplication, type UploadFile } from '../api/client';
import { useProfile } from '../state/profile';
import { Badge, Button, Card, Text, colors, s } from './ui';
import { CheckoutField } from './checkout-field';
import { PharmacyBranchDetailsFields, usePharmacyBranchDetails } from './pharmacy-branch-details';
import { PrivateDocument } from './private-document';
import { applicationErrors, documentKinds, documentLabels, type ApplicationValues } from '../domain/pharmacy-application';

export function PharmacyApplicationForm({ app, onSaved, editable = true }: { app: PharmacyApplication | null; editable?: boolean; onSaved: (app: PharmacyApplication) => void }) {
  const { profile, refreshProfile } = useProfile();
  const [values, setValues] = useState<ApplicationValues>({ name: app?.name || '', address: app?.address || '', applicant: app?.applicant || profile?.fullName || '', email: app?.email || profile?.email || '', phone: app?.phone || profile?.phone || '', hours: app?.hours || '' });
  const details = usePharmacyBranchDetails(app, profile?.phone);
  const effectiveValues = { ...values, phone: details.phone, hours: details.hours };
  const [files, setFiles] = useState<Partial<Record<typeof documentKinds[number], UploadFile>>>({});
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const savedApplication = useRef(app);
  if (app && (!savedApplication.current || app.version >= savedApplication.current.version)) savedApplication.current = app;
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [issue, setIssue] = useState('');
  const wide = useWindowDimensions().width >= 760;
  const errors = applicationErrors(effectiveValues, submitting);
  const complete = documentKinds.every(kind => files[kind] || app?.documents.some(doc => doc.kind === kind));
  async function choose(kind: typeof documentKinds[number]) {
    setIssue('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      if ((file.size ?? 0) > 10 * 1024 * 1024) { setIssue('Choose a file up to 10 MB.'); return; }
      if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) { setIssue('Choose a PDF, PNG, or JPEG file.'); return; }
      setFiles(previous => ({ ...previous, [kind]: { uri: file.uri, name: file.name, mimeType: file.mimeType || 'application/octet-stream' } }));
      setMessage('');
    } catch { setIssue('Could not open the file picker. Please try again.'); }
  }
  async function persist(submit: boolean) {
    if (working.current) return;
    setAttempted(true); setSubmitting(submit); setIssue(''); setMessage('');
    if (Object.keys(applicationErrors(effectiveValues, submit)).length || details.contactIssue(submit) || details.hoursIssue) { setIssue(details.contactIssue(submit) || details.hoursIssue || 'Check the highlighted fields.'); return; }
    if (submit && !complete) { setIssue('Attach all three required documents.'); return; }
    working.current = true; setBusy(true);
    try {
      let current = await api.pharmacyApplication({ ...Object.fromEntries(Object.entries(effectiveValues).map(([key, value]) => [key, value.trim()])), ...details.payload }, !!savedApplication.current);
      savedApplication.current = current; onSaved(current);
      for (const kind of documentKinds) {
        const file = files[kind];
        if (!file) continue;
        setMessage('Uploading ' + documentLabels[kind].toLowerCase() + '...');
        current = await api.pharmacyUploadDocument(kind, file);
        savedApplication.current = current; onSaved(current);
        setFiles(previous => { const next = { ...previous }; delete next[kind]; return next; });
      }
      if (submit) { current = await api.pharmacySubmitApplication(); savedApplication.current = current; onSaved(current); }
      setMessage(submit ? 'Application submitted for review.' : 'Changes and documents saved.');
      await refreshProfile();
    } catch (error) { setMessage(''); setIssue((error instanceof Error ? error.message : 'Could not save the application.') + ' Your entered details and any remaining selected files are kept here so you can retry.'); }
    finally { working.current = false; setBusy(false); }
  }
  return <View style={{ gap: 20 }}>
    <Card><Text style={s.heading}>Branch details</Text><Text style={s.muted}>{editable ? 'Fields marked * are required for submission.' : 'Submitted branch details.'}</Text>
      <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: 18 }}>
        {(['name', 'applicant', 'email', 'address'] as const).map(key => <View key={key} style={{ width: wide && key !== 'address' ? '48%' : '100%', flexGrow: 1 }}>
          <CheckoutField label={{ name: 'Pharmacy / branch name *', applicant: 'Owner / authorized representative *', email: 'Branch email *', phone: 'Contact number *', address: 'Full branch address *', hours: 'Opening hours *' }[key]}
            placeholder={{ name: 'Registered pharmacy and branch name', applicant: 'Full name', email: 'pharmacy@example.com', phone: '09XXXXXXXXX', address: 'Building, street, barangay, Cagayan de Oro City', hours: 'e.g. Monday to Saturday, 8 AM - 8 PM' }[key]}
            value={values[key]} onChangeText={value => setValues(previous => ({ ...previous, [key]: value }))} error={editable && attempted ? errors[key] : undefined}
            maxLength={key === 'address' ? 500 : 150} multiline={key === 'address'} keyboardType={key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'sentences'} editable={editable && !busy} />
        </View>)}
      </View>
    </Card>
    <Card><PharmacyBranchDetailsFields details={details} disabled={busy} readOnly={!editable} attempted={attempted} /></Card>
    <Card><Text style={s.heading}>Supporting documents</Text><Text style={s.muted}>PDF, PNG, or JPEG. Up to 10 MB per file. Files are private and available to authorized reviewers.</Text>
      {documentKinds.map(kind => { const file = files[kind]; const document = app?.documents.find(doc => doc.kind === kind); return <View key={kind} style={{ gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line }}>
        <View style={s.between}><Text style={s.heading}>{documentLabels[kind]} *</Text><Badge text={file ? 'Selected' : document ? 'Uploaded' : 'Required'} neutral={!file && !document} /></View>
        <Text style={s.muted}>{{ FDA: 'Current license to operate for this branch.', Business: 'Current permit matching the pharmacy business.', Pharmacist: 'Credentials of the pharmacist responsible for this branch.' }[kind]}</Text>
        {file && <Text style={s.text}>{file.name}</Text>}
        {document && !file && <PrivateDocument name={document.file_name || document.name} load={() => api.pharmacyDocument(document.id)} title="View uploaded file" />}
        {editable && <Button title={file || document ? 'Choose replacement' : 'Choose file'} secondary icon="upload" disabled={busy} onPress={() => void choose(kind)} />}
        {file && <Button title="Remove selected file" secondary disabled={busy} onPress={() => setFiles(previous => { const next = { ...previous }; delete next[kind]; return next; })} />}
      </View>; })}
    </Card>
    {editable && <Card><Text style={s.heading}>Save or submit</Text><Text style={s.muted}>Save your progress at any time. Submit when all details and documents are ready for admin review.</Text>
      {!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={s.muted}>{message}</Text>}
      <Button title={busy ? 'Saving...' : 'Save changes'} secondary disabled={busy} onPress={() => void persist(false)} />
      <Button title={app && app.status !== 'Draft' ? 'Resubmit application' : 'Submit application'} disabled={busy || !complete} onPress={() => void persist(true)} />
    </Card>}
  </View>;
}
