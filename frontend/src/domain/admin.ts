export type PharmacyReviewStatus = 'Pending' | 'Needs Info' | 'Approved' | 'Rejected';
export type MedicineReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export function reviewRecord<T extends { status: string; notes?: string }>(record: T, status: Exclude<PharmacyReviewStatus, 'Pending'>, notes: string): T {
  if (!['Pending', 'Needs Info'].includes(record.status)) throw new Error('This application has already been reviewed.');
  if (status !== 'Approved' && !notes.trim()) throw new Error('Enter a review reason before rejecting or requesting information.');
  return { ...record, status, notes: notes.trim().slice(0, 1000) };
}

export function reviewCounts(records: { status: string }[]) {
  return { pending: records.filter(r => r.status === 'Pending').length, approved: records.filter(r => r.status === 'Approved').length, rejected: records.filter(r => r.status === 'Rejected').length };
}
