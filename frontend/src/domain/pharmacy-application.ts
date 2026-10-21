import { contactError } from './pharmacy-contacts.ts';
export const documentKinds = ['FDA', 'Business', 'Pharmacist'] as const;
export const documentLabels = { FDA: 'FDA license', Business: 'Business permit', Pharmacist: 'Pharmacist credentials' };
export type ApplicationValues = Record<'name' | 'address' | 'applicant' | 'email' | 'phone' | 'hours', string>;
export function applicationErrors(values: ApplicationValues, submitting = true): Partial<ApplicationValues> {
  const errors: Partial<ApplicationValues> = {};
  for (const key of ['name', 'address', 'applicant', 'email', 'phone', 'hours'] as const) if ((submitting || !['phone', 'hours'].includes(key)) && !values[key].trim()) errors[key] = 'This field is required.';
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.phone.trim()) { const issue = contactError(values.phone); if (issue) errors.phone = issue; }
  return errors;
}
