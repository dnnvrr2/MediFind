// Only internal customer destinations may be resumed after authentication.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.includes('\\') || /[\r\n]/.test(value)) return '/home';
  return /^\/(availability\/[^/?#]+|prescriptions(?:\/[^?#]*)?|home|cart|checkout|orders(?:\/[^?#]*)?|profile)(?:\?[^#]*)?$/.test(value) ? value : '/home';
}

export function needsCustomer(path: string): boolean {
  return /^\/(home|cart|checkout|prescriptions|orders|profile\/edit)(\/|$)/.test(path);
}
