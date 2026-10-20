import { medicines, pharmacies, offers } from '../data/catalog.ts';

export type PrescriptionFile = { uri: string; name: string; mimeType: string; size: number };
export type RequestLine = { medicineId: string; quantity: number };
export type PrescriptionStatus = 'draft' | 'pending' | 'approved' | 'partially_approved' | 'rejected' | 'needs_clearer_photo';
export type Prescription = { id: string; revision: number; createdAt: number; updatedAt: number; file: PrescriptionFile; status: PrescriptionStatus; requested: RequestLine[]; pharmacyId: string; approved: RequestLine[]; note: string };
export type Approval = { prescriptionId: string; revision: number; pharmacyId: string; medicineId: string; quantity: number; reviewedAt: number };
export const prescriptionLabels: Record<PrescriptionStatus, string> = { draft: 'Draft', pending: 'Awaiting review', approved: 'Approved · demo', partially_approved: 'Partially approved · demo', rejected: 'Rejected · demo', needs_clearer_photo: 'Clearer photo needed' };
export function fileIssue(file: PrescriptionFile): string {
  if (!file.uri || !file.name.trim()) return 'Choose a file first.';
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimeType)) return 'Choose a JPG, PNG, or PDF file.';
  if (!Number.isFinite(file.size) || file.size < 1) return 'This file is empty or its size could not be checked. Choose another file.';
  if (file.size > 10 * 1024 * 1024) return 'Choose a file of 10 MB or less.';
  return '';
}
export function requestIssue(lines: RequestLine[]): string {
  if (!lines.length) return 'Add at least one sample request item.';
  if (new Set(lines.map(l => l.medicineId)).size !== lines.length) return 'Each sample medicine can appear only once.';
  return lines.some(l => !medicines.some(m => m.id === l.medicineId) || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 100) ? 'Use a listed medicine and a whole quantity from 1 to 100.' : '';
}
export function pharmacyEstimate(lines: RequestLine[], pharmacyId: string) {
  const rows = lines.map(line => {
    const offer = offers.find(o => o.medicineId === line.medicineId && o.pharmacyId === pharmacyId);
    const available = Math.min(line.quantity, offer?.stock ?? 0);
    return { ...line, available, unitPrice: offer?.price ?? null, subtotal: available * (offer?.price ?? 0) };
  });
  return { rows, total: rows.reduce((sum, row) => sum + row.subtotal, 0), all: rows.length > 0 && rows.every(row => row.available === row.quantity), any: rows.some(row => row.available > 0) };
}
export type PrescriptionResult = { ok: true; record: Prescription } | { ok: false; issue: string };
export function submitPrescription(record: Prescription, at: number): PrescriptionResult {
  if (record.status !== 'draft') return { ok: false, issue: 'This prescription has already been submitted. Replace the file to begin another review.' };
  const issue = fileIssue(record.file) || requestIssue(record.requested);
  if (issue) return { ok: false, issue };
  if (!pharmacies.some(p => p.id === record.pharmacyId) || !pharmacyEstimate(record.requested, record.pharmacyId).any) return { ok: false, issue: 'Select a pharmacy with at least one available sample item.' };
  return { ok: true, record: { ...record, requested: record.requested.map(l => ({ ...l })), status: 'pending', approved: [], note: '', updatedAt: at } };
}
export function reviewPrescription(record: Prescription, outcome: 'approved' | 'partially_approved' | 'rejected' | 'needs_clearer_photo', lines: RequestLine[], note: string, at: number): PrescriptionResult {
  if (record.status !== 'pending') return { ok: false, issue: 'Only a pending prescription can be reviewed.' };
  if (!['approved', 'partially_approved', 'rejected', 'needs_clearer_photo'].includes(outcome)) return { ok: false, issue: 'Choose a review outcome.' };
  const accepts = outcome === 'approved' || outcome === 'partially_approved';
  if (outcome !== 'approved' && !note.trim()) return { ok: false, issue: 'Enter a reason for this simulated outcome.' };
  if (accepts) {
    const issue = requestIssue(lines);
    if (issue) return { ok: false, issue };
    for (const line of lines) {
      const requested = record.requested.find(l => l.medicineId === line.medicineId);
      const offer = offers.find(o => o.medicineId === line.medicineId && o.pharmacyId === record.pharmacyId);
      if (!requested || !offer || line.quantity > requested.quantity || line.quantity > offer.stock) return { ok: false, issue: 'Approved quantities must fit the request and this pharmacy’s sample stock.' };
    }
    const full = lines.length === record.requested.length && record.requested.every(r => lines.some(l => l.medicineId === r.medicineId && l.quantity === r.quantity));
    if ((outcome === 'approved') !== full) return { ok: false, issue: full ? 'Use Approved when every requested unit is accepted.' : 'Use Partially approved when items or quantities are reduced.' };
  }
  return { ok: true, record: { ...record, status: outcome, approved: accepts ? lines.map(l => ({ ...l })) : [], note: note.trim(), updatedAt: at } };
}
export function replacePrescription(record: Prescription, file: PrescriptionFile, at: number): PrescriptionResult {
  const issue = fileIssue(file);
  if (issue) return { ok: false, issue };
  if (record.status === 'pending') return { ok: false, issue: 'Wait for the review outcome before replacing this file.' };
  return { ok: true, record: { ...record, file: { ...file }, revision: record.revision + 1, status: 'draft', approved: [], note: '', updatedAt: at } };
}
export function prescriptionGrants(records: Prescription[]): Approval[] {
  return records.filter(r => r.status === 'approved' || r.status === 'partially_approved').flatMap(r => r.approved.map(l => ({ ...l, prescriptionId: r.id, revision: r.revision, pharmacyId: r.pharmacyId, reviewedAt: r.updatedAt })));
}
export function approvalFor(item: { medicineId: string; pharmacyId: string; quantity: number; prescriptionId?: string; revision?: number }, grants: Approval[]): Approval | undefined {
  return grants.find(g => g.prescriptionId === item.prescriptionId && g.revision === item.revision && g.medicineId === item.medicineId && g.pharmacyId === item.pharmacyId && g.quantity >= item.quantity);
}
