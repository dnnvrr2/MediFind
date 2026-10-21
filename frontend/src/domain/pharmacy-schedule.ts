export type OpeningDay = { day: number; open: boolean; opens: string; closes: string; allDay: boolean };
export const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const defaultSchedule = (): OpeningDay[] => dayNames.map((_, day) => ({ day, open: day < 6, opens: '08:00', closes: '17:00', allDay: false }));
export function timeLabel(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
export function scheduleError(rows: OpeningDay[]): string {
  if (rows.length !== 7 || rows.some((row, index) => row.day !== index)) return 'Set a schedule for all seven days.';
  if (!rows.some(row => row.open)) return 'Choose at least one opening day.';
  if (rows.some(row => row.open && !row.allDay && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.opens) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.closes) || row.opens === row.closes))) return 'Choose different opening and closing times, or select 24 hours.';
  return '';
}
export function scheduleSummary(rows: OpeningDay[]): string {
  const groups: { days: string[]; key: string; text: string }[] = [];
  for (const row of rows) {
    const key = !row.open ? 'closed' : row.allDay ? '24h' : row.opens + '-' + row.closes;
    const text = !row.open ? 'Closed' : row.allDay ? '24 hours' : `${timeLabel(row.opens)} - ${timeLabel(row.closes)}${row.closes < row.opens ? ' (+1 day)' : ''}`;
    const last = groups.at(-1);
    if (last?.key === key) last.days.push(dayNames[row.day]);
    else groups.push({ days: [dayNames[row.day]], key, text });
  }
  return groups.map(group => `${group.days.length === 7 ? 'Every day' : group.days.length > 2 ? group.days[0] + '-' + group.days.at(-1) : group.days.join(', ')}: ${group.text}`).join('; ');
}
