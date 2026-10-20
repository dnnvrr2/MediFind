import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { api } from '../api/client';
import { fileIssue, submitPrescription, reviewPrescription, replacePrescription, type Prescription, type PrescriptionFile, type PrescriptionResult, type RequestLine } from '../domain/prescriptions';
import { useProfile } from './profile';

type ContextValue = {
  records: Prescription[];
  loading: boolean;
  syncIssue: string;
  create: (file: PrescriptionFile) => PrescriptionResult;
  edit: (id: string, requested: RequestLine[], pharmacyId: string) => PrescriptionResult;
  submit: (id: string, requested: RequestLine[], pharmacyId: string) => PrescriptionResult;
  review: (id: string, outcome: 'approved' | 'partially_approved' | 'rejected' | 'needs_clearer_photo', lines: RequestLine[], note: string) => PrescriptionResult;
  replace: (id: string, file: PrescriptionFile) => PrescriptionResult;
};
type RemotePrescription = { external_id: string; data: string | Prescription; file_url: string | null; original_filename: string };
const Context = createContext<ContextValue | null>(null);
const rows = (value: { results?: RemotePrescription[] } | RemotePrescription[]) => Array.isArray(value) ? value : value.results ?? [];

export function PrescriptionsProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  const [records, setRecords] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncIssue, setSyncIssue] = useState('');
  const latest = useRef(records);
  const next = useRef(1);
  const queue = useRef(new Map<string, Promise<void>>());
  function commit(result: PrescriptionResult) {
    if (result.ok) {
      latest.current = [result.record, ...latest.current.filter(r => r.id !== result.record.id)].sort((a, b) => b.createdAt - a.createdAt);
      setRecords(latest.current);
      if (profile) persist(result.record);
    }
    return result;
  }
  function persist(record: Prescription) {
    const previous = queue.current.get(record.id) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(async () => {
      const file = record.file.uri.startsWith('remote:') ? undefined : record.file;
      const safeRecord = { ...record, file: { ...record.file, uri: '' } };
      await api.savePrescription(record.id, safeRecord, file);
      setSyncIssue('');
    }).catch(() => setSyncIssue('Prescription changes could not be synced. Check your connection and sign in again.'));
    queue.current.set(record.id, task);
  }
  useEffect(() => {
    let active = true;
    if (!profile) { latest.current = []; setRecords([]); setLoading(false); setSyncIssue(''); return () => { active = false; }; }
    setLoading(true);
    api.listPrescriptions<RemotePrescription>().then(response => {
      if (!active) return;
      const restored = rows(response).map(row => {
        const record = (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) as Prescription;
        return { ...record, id: row.external_id, file: { ...record.file, uri: row.file_url ? `remote:${row.file_url}` : record.file.uri, name: row.original_filename || record.file.name } };
      });
      latest.current = restored.sort((a, b) => b.createdAt - a.createdAt);
      setRecords(latest.current);
    }).catch(() => { if (active) setSyncIssue('Saved prescriptions could not be loaded. Check your connection.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile?.email]);
  function update(id: string, action: (record: Prescription) => PrescriptionResult) {
    const record = latest.current.find(r => r.id === id);
    return record ? commit(action(record)) : { ok: false as const, issue: 'This prescription is not available in the current account.' };
  }
  return <Context.Provider value={{ records, loading, syncIssue,
    create: file => {
      const issue = fileIssue(file);
      if (issue) return { ok: false, issue };
      const at = Date.now();
      return commit({ ok: true, record: { id: `RX-${String(next.current++).padStart(4, '0')}`, revision: 1, createdAt: at, updatedAt: at, file: { ...file }, status: 'draft', requested: [], pharmacyId: '', approved: [], note: '' } });
    },
    edit: (id, requested, pharmacyId) => update(id, record => record.status === 'draft' ? { ok: true, record: { ...record, requested, pharmacyId } } : { ok: false, issue: 'This request has already been submitted.' }),
    submit: (id, requested, pharmacyId) => update(id, record => submitPrescription({ ...record, requested, pharmacyId }, Date.now())),
    review: (id, outcome, lines, note) => update(id, record => reviewPrescription(record, outcome, lines, note, Date.now())),
    replace: (id, file) => update(id, record => replacePrescription(record, file, Date.now())),
  }}>{children}</Context.Provider>;
}
export function usePrescriptions() {
  const value = useContext(Context);
  if (!value) throw new Error('PrescriptionsProvider missing');
  return value;
}
