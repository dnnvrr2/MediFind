import { useState } from 'react';
import { View } from 'react-native';
import type { PharmacyApplication } from '../api/client';
import { contactsError } from '../domain/pharmacy-contacts';
import { defaultSchedule, scheduleError, scheduleSummary, type OpeningDay } from '../domain/pharmacy-schedule';
import { PharmacyContactsEditor } from './pharmacy-contacts-editor';
import { OpeningHoursEditor } from './opening-hours-editor';
import { Button, Text, s } from './ui';

export function usePharmacyBranchDetails(app: PharmacyApplication | null, fallbackPhone = '') {
  const [contacts, setContacts] = useState<string[]>(app?.contact_numbers?.length ? app.contact_numbers : [app?.phone || fallbackPhone]);
  const [schedule, setSchedule] = useState<OpeningDay[]>(app?.opening_schedule?.length ? app.opening_schedule : defaultSchedule());
  const [scheduleActive, setScheduleActive] = useState(!!app?.opening_schedule?.length || !app?.hours);
  const hours = scheduleActive ? scheduleSummary(schedule) : app?.hours || '';
  const phone = contacts[0]?.trim() || '';
  const contactIssue = (required = true) => contactsError(contacts, required);
  const hoursIssue = scheduleActive ? scheduleError(schedule) : !hours.trim() ? 'Set your opening hours.' : '';
  const payload = { phone, contact_numbers: contacts.filter(value => value.trim()).map(value => value.trim()), hours, ...(scheduleActive ? { opening_schedule: schedule } : {}) };
  return { contacts, setContacts, schedule, setSchedule, scheduleActive, setScheduleActive, hours, phone, contactIssue, hoursIssue, payload };
}

export function PharmacyBranchDetailsFields({ details, disabled = false, readOnly = false, attempted = false }: { details: ReturnType<typeof usePharmacyBranchDetails>; disabled?: boolean; readOnly?: boolean; attempted?: boolean }) {
  return <View style={{ gap: 24 }}>
    <PharmacyContactsEditor values={details.contacts} onChange={details.setContacts} disabled={disabled} readOnly={readOnly} attempted={attempted} />
    {details.scheduleActive ? <OpeningHoursEditor value={details.schedule} onChange={details.setSchedule} disabled={disabled} readOnly={readOnly} /> : <View style={{ gap: 10 }}><Text style={s.heading}>Opening hours *</Text><Text style={s.muted}>{details.hours}</Text>{!readOnly && <Button title="Set days and times" secondary icon="clock" disabled={disabled} onPress={() => details.setScheduleActive(true)} />}</View>}
  </View>;
}
