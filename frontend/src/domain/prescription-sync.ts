export function mergePendingRecords<T extends { id: string; createdAt: number }>(remote: T[], pending: ReadonlyMap<string, T>): T[] {
  const records = new Map(remote.map(record => [record.id, record]));
  pending.forEach(record => records.set(record.id, record));
  return [...records.values()].sort((a, b) => b.createdAt - a.createdAt);
}
