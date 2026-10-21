export function contactError(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (!compact) return 'Enter a contact number.';
  let remainder: string;
  let expected: number;
  if (compact.startsWith('+63')) { remainder = compact.slice(3); expected = 10; }
  else if (compact.startsWith('09')) { remainder = compact.slice(2); expected = 9; }
  else return 'Start the mobile number with 09 or +63.';
  if (!/^\d*$/.test(remainder)) return 'Use digits only after the prefix.';
  if (remainder.length !== expected) return `${remainder.length < expected ? 'Too few' : 'Too many'} digits: use ${expected} digits after ${expected === 10 ? '+63' : '09'} (${remainder.length}/${expected}).`;
  if (expected === 10 && !remainder.startsWith('9')) return 'The 10 digits after +63 must start with 9.';
  return '';
}
export function canonicalContact(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  return compact.startsWith('09') ? '+63' + compact.slice(1) : compact;
}
export function contactsError(values: string[], required = true): string {
  if (values.length > 5) return 'Add up to five contact numbers.';
  if (!required && values.every(value => !value.trim())) return '';
  for (const value of values) { const issue = contactError(value); if (issue) return issue; }
  const canonical = values.map(canonicalContact);
  return new Set(canonical).size !== canonical.length ? 'Remove the duplicate contact number.' : '';
}
