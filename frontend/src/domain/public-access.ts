// Only internal destinations may be resumed; admin performs its own staff check.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.includes('\\') || /[\r\n]/.test(value)) return '/home';
  return /^\/(availability\/[^/?#]+|prescriptions(?:\/[^?#]*)?|home|cart|checkout|orders(?:\/[^?#]*)?|profile|admin|partner)(?:\?[^#]*)?$/.test(value) ? value : '/home';
}

export function needsCustomer(path: string): boolean {
  return /^\/(home|cart|checkout|prescriptions|orders|profile\/edit|admin|partner)(\/|$)/.test(path);
}

// Successful customer sign-in must not resume a staff-only destination.
// Staff permissions are still checked by the admin route and API.
export function signedInDestination(returnTo: unknown, isStaff: boolean): string {
  const destination = safeReturnTo(returnTo);
  return !isStaff && /^\/admin(?:[/?#]|$)/.test(destination) ? '/home' : destination;
}
