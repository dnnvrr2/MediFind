import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Button, Text, colors, s } from './ui';
import { dayNames, timeLabel, scheduleSummary, scheduleError, type OpeningDay } from '../domain/pharmacy-schedule';

function HoursSwitch({ accessibilityLabel, value, onValueChange, disabled = false }: {
  accessibilityLabel: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={accessibilityLabel}
    accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onValueChange(!value)}
    style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}>
    <View pointerEvents="none" style={{ width: 36, height: 20, borderRadius: 10, borderWidth: 1, borderColor: value ? '#086359' : '#596762', backgroundColor: value ? colors.teal : '#718079', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.white, left: value ? 18 : 2, borderWidth: 1, borderColor: '#DFE6E2' }} />
    </View>
  </Pressable>;
}

function TimePicker({ value, onChange, disabled, label }: { value: string; onChange: (value: string) => void; disabled: boolean; label: string }) {
  const [visible, setVisible] = useState(false);
  const [selection, setSelection] = useState(value);
  const [hour, minute] = selection.split(':').map(Number);
  const period = hour < 12 ? 'AM' : 'PM';
  function choose(displayHour: number, chosenMinute: number, chosenPeriod: string) { setSelection(String(displayHour % 12 + (chosenPeriod === 'PM' ? 12 : 0)).padStart(2, '0') + ':' + String(chosenMinute).padStart(2, '0')); }
  return <View style={{ flex: 1, minWidth: 120, gap: 5 }}><Text style={s.caption}>{label}</Text><Button title={timeLabel(value)} secondary disabled={disabled} onPress={() => { setSelection(value); setVisible(true); }} />
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0008', padding: 20 }}><View accessibilityViewIsModal style={[s.card, { width: '100%', maxWidth: 440, maxHeight: '90%' }]}><ScrollView contentContainerStyle={{ gap: 16 }}><Text style={s.heading}>{label}</Text><Text style={s.title}>{timeLabel(selection)}</Text>
      <Text style={s.caption}>Hour</Text><View style={s.row}>{Array.from({ length: 12 }, (_, index) => index + 1).map(number => <Button key={number} title={String(number)} secondary={(hour % 12 || 12) !== number} onPress={() => choose(number, minute, period)} />)}</View>
      <Text style={s.caption}>Minute</Text><View style={s.row}>{[...new Set([0, 15, 30, 45, minute])].sort((a, b) => a - b).map(number => <Button key={number} title={String(number).padStart(2, '0')} secondary={minute !== number} onPress={() => choose(hour % 12 || 12, number, period)} />)}</View>
      <View style={s.row}>{['AM', 'PM'].map(item => <Button key={item} title={item} secondary={period !== item} onPress={() => choose(hour % 12 || 12, minute, item)} />)}</View>
      <Button title="Set time" onPress={() => { onChange(selection); setVisible(false); }} /><Button title="Cancel" secondary onPress={() => setVisible(false)} />
    </ScrollView></View></View></Modal>
  </View>;
}

export function OpeningHoursEditor({ value, onChange, disabled = false, readOnly = false }: { value: OpeningDay[]; onChange: (rows: OpeningDay[]) => void; disabled?: boolean; readOnly?: boolean }) {
  const first = value.find(row => row.open) || value[0];
  const [custom, setCustom] = useState(value.filter(row => row.open).some(row => row.opens !== first.opens || row.closes !== first.closes || row.allDay !== first.allDay));
  const issue = scheduleError(value);
  function patch(day: number | null, changes: Partial<OpeningDay>) { onChange(value.map(row => day === null ? { ...row, ...changes } : row.day === day ? { ...row, ...changes } : row)); }
  function times(row: OpeningDay, day: number | null) { return <View style={{ gap: 8 }}><View style={s.between}><Text style={s.muted}>Open 24 hours</Text><HoursSwitch accessibilityLabel={day === null ? 'Open 24 hours' : `${dayNames[day]} open 24 hours`} value={row.allDay} disabled={disabled || readOnly} onValueChange={allDay => patch(day, { allDay })} /></View>{!row.allDay && <View style={s.row}><TimePicker value={row.opens} label="Opens at" disabled={disabled || readOnly} onChange={opens => patch(day, { opens })} /><TimePicker value={row.closes} label="Closes at" disabled={disabled || readOnly} onChange={closes => patch(day, { closes })} /></View>}{!row.allDay && row.closes < row.opens && <Text style={s.caption}>Closes the following day.</Text>}</View>; }
  return <View style={{ gap: 14 }}><Text style={s.heading}>Opening hours *</Text>
    {readOnly ? <Text style={s.text}>{scheduleSummary(value)}</Text> : <>
      <View style={s.between}><Text style={s.muted}>Different hours by day</Text><HoursSwitch accessibilityLabel="Different hours by day" value={custom} disabled={disabled} onValueChange={next => { if (!next && custom) patch(null, { opens: first.opens, closes: first.closes, allDay: first.allDay }); setCustom(next); }} /></View>
      <View style={s.row}>{['Mon-Fri', 'Mon-Sat', 'Every day'].map((label, index) => <Button key={label} title={label} secondary disabled={disabled} onPress={() => onChange(value.map(row => ({ ...row, open: row.day < [5, 6, 7][index] })))} />)}</View>
      {custom ? value.map(row => <View key={row.day} style={{ gap: 10, borderBottomWidth: 1, borderColor: colors.line, paddingBottom: 12 }}><View style={s.between}><Text style={s.heading}>{dayNames[row.day]}</Text><View style={s.row}><Text style={s.muted}>{row.open ? 'Open' : 'Closed'}</Text><HoursSwitch accessibilityLabel={`${dayNames[row.day]} open`} value={row.open} disabled={disabled} onValueChange={open => patch(row.day, { open })} /></View></View>{row.open && times(row, row.day)}</View>) : <><Text style={s.caption}>Select opening days</Text><View style={s.row}>{value.map(row => <Pressable key={row.day} accessibilityRole="checkbox" accessibilityState={{ checked: row.open, disabled }} disabled={disabled} onPress={() => patch(row.day, { open: !row.open })} style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderRadius: 8, borderColor: row.open ? colors.teal : colors.line, backgroundColor: row.open ? colors.pale : colors.white }}><Text style={row.open ? s.link : s.muted}>{dayNames[row.day]}</Text></Pressable>)}</View>{times(first, null)}</>}
      {issue ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text> : <Text style={s.muted}>{scheduleSummary(value)}</Text>}
    </>}
  </View>;
}
