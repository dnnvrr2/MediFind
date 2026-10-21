import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { api, sessionGeneration } from '../api/client';
import { fileIssue, submitPrescription, reviewPrescription, replacePrescription, type Prescription, type PrescriptionFile, type PrescriptionResult, type RequestLine } from '../domain/prescriptions';
import { mergePendingRecords } from '../domain/prescription-sync';
import { useProfile } from './profile';

type ContextValue = {
  records: Prescription[];
  loading: boolean;
  refresh: () => Promise<void>;
  syncIssue: string;
  retrySync: () => Promise<void>;
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
  const pending = useRef(new Map<string, Prescription>());
  const failures = useRef(new Map<string, string>());
  const uploaded = useRef(new Map<string, number>());
  const edits = useRef(0);
  const alive = useRef(true);
  const generation = useRef(sessionGeneration()).current;
  const valid = () => alive.current && generation === sessionGeneration();
  function unpack(row: RemotePrescription): Prescription {
    const record = (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) as Prescription;
    return { ...record, id: row.external_id, file: { ...record.file, uri: row.file_url ? `remote:${row.file_url}` : record.file.uri, name: row.original_filename || record.file.name } };
  }
  function syncMessage() {
    setSyncIssue(failures.current.size ? 'Some prescription changes are not saved yet. ' + [...failures.current.values()][0] + ' Your selected files and edits are kept here. Retry before refreshing or signing out.' : pending.current.size ? 'Saving prescription changes...' : '');
  }
  function merge(remote: Prescription[]) {
    latest.current = mergePendingRecords(remote, pending.current);
    setRecords(latest.current);
  }
  function persist(record: Prescription): Promise<void> {
    const previous = queue.current.get(record.id) || Promise.resolve();
    const task = previous.catch(() => undefined).then(async () => {
      if (!valid() || pending.current.get(record.id) !== record) return;
      const file = record.file.uri.startsWith('remote:') || uploaded.current.get(record.id) === record.revision ? undefined : record.file;
      const safeRecord = { ...record, file: { ...record.file, uri: '' } };
      const saved = await api.savePrescription(record.id, safeRecord, file) as RemotePrescription;
      if (!valid()) return;
      if (file) uploaded.current.set(record.id, record.revision);
      if (pending.current.get(record.id) === record) {
        pending.current.delete(record.id); failures.current.delete(record.id); edits.current++;
        const acknowledged = unpack(saved);
        merge([acknowledged, ...latest.current.filter(row => row.id !== record.id)]);
      }
      syncMessage();
    }).catch(error => { if (valid() && pending.current.has(record.id)) { failures.current.set(record.id, error instanceof Error ? error.message : 'Save failed.'); syncMessage(); } });
    queue.current.set(record.id, task);
    void task.finally(() => { if (queue.current.get(record.id) === task) queue.current.delete(record.id); });
    return task;
  }
  function commit(result: PrescriptionResult) {
    if (result.ok && valid()) {
      edits.current++;
      pending.current.set(result.record.id, result.record);
      merge(latest.current);
      syncMessage();
      if (profile) void persist(result.record);
    }
    return result;
  }
  const refresh = useCallback(async () => {
    if (!profile || !valid()) return;
    const before = edits.current;
    try {
      const response = await api.listPrescriptions<RemotePrescription>();
      if (!valid() || edits.current !== before) return;
      merge(rows(response).map(unpack)); syncMessage();
    } catch { if (valid()) setSyncIssue(failures.current.size ? 'Unsaved prescription changes are kept here. Retry when connected.' : 'Saved prescriptions could not be refreshed.'); }
    finally { if (valid()) setLoading(false); }
  }, [profile?.id, profile?.email, generation]);
  useEffect(() => {
    alive.current = true;
    if (profile) { setLoading(true); void refresh(); }
    const timer = profile ? setInterval(() => void refresh(), 20000) : undefined;
    return () => { alive.current = false; if (timer) clearInterval(timer); };
  }, [refresh]);
  async function retrySync() {
    await Promise.all([...pending.current.values()].map(record => persist(record)));
    await refresh();
  }
  function update(id: string, action: (record: Prescription) => PrescriptionResult) {
    const record = latest.current.find(r => r.id === id);
    return record ? commit(action(record)) : { ok: false as const, issue: 'This prescription is not available in the current account.' };
  }
  return <Context.Provider value={{ records, loading, syncIssue, refresh, retrySync,
    create: file => {
      const issue = fileIssue(file);
      if (issue) return { ok: false, issue };
      const at = Date.now();
      return commit({ ok: true, record: { id: `RX-${Date.now()}-${next.current++}`, revision: 1, createdAt: at, updatedAt: at, file: { ...file }, status: 'draft', requested: [], pharmacyId: '', approved: [], note: '' } });
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
