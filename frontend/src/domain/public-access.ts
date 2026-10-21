// Only internal destinations may be resumed; admin performs its own staff check.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.includes('\\') || /[\r\n]/.test(value)) return '/home';
  return /^\/(availability\/[^/?#]+|prescriptions(?:\/[^?#]*)?|home|cart|checkout|orders(?:\/[^?#]*)?|profile|admin|partner|partnership|rider(?:\/(?:deliveries|history|profile|delivery\/[^/?#]+|issue\/[^/?#]+))?)(?:\?[^#]*)?$/.test(value) ? value : '/home';
}

export function needsCustomer(path: string): boolean {
  return /^\/(home|cart|checkout|prescriptions|orders|profile\/edit|admin|partner|rider)(\/|$)/.test(path);
}

export function accountHome(profile: { isStaff?: boolean; isRider?: boolean; pharmacyStatus?: string | null } | null): '/' | '/home' | '/admin' | '/partner' | '/rider' {
  if (!profile) return '/';
  if (profile.isStaff) return '/admin';
  if (profile.pharmacyStatus === 'Approved') return '/partner';
  if (profile.isRider) return '/rider';
  return '/home';
}

export function pharmacyTabs(approved: boolean): { key: string; label: string; icon: 'home' | 'medicine' | 'prescription' | 'orders' | 'profile' }[] {
  return approved ? [
    { key: 'dashboard', label: 'Dashboard', icon: 'home' }, { key: 'inventory', label: 'Inventory', icon: 'medicine' },
    { key: 'prescriptions', label: 'Prescriptions', icon: 'prescription' }, { key: 'orders', label: 'Orders', icon: 'orders' },
    { key: 'profile', label: 'Profile', icon: 'profile' },
  ] : [{ key: 'dashboard', label: 'Application', icon: 'home' }, { key: 'profile', label: 'Profile', icon: 'profile' }];
}

// Successful customer sign-in must not resume a staff-only destination.
// Staff permissions are still checked by the admin route and API.
export function signedInDestination(returnTo: unknown, isStaff: boolean, profile?: Parameters<typeof accountHome>[0]): string {
  const destination = safeReturnTo(returnTo);
  if (/^\/rider(?:[/?#]|$)/.test(destination) && !profile?.isRider) return accountHome(profile ?? { isStaff });
  if (destination === '/home') return accountHome(profile ?? { isStaff });
  return !isStaff && /^\/admin(?:[/?#]|$)/.test(destination) ? accountHome(profile ?? { isStaff }) : destination;
}

export function navigationPortal(path: string, profile: Parameters<typeof accountHome>[0]): 'admin' | 'partner' | 'rider' | 'guest' | 'customer' {
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
  if (path === '/partner' || path.startsWith('/partner/')) return 'partner';
  if (path === '/rider' || path.startsWith('/rider/')) return 'rider';
  if (['/help', '/privacy', '/terms', '/partnership'].includes(path) || path.startsWith('/account/')) {
    const home = accountHome(profile);
    if (home === '/admin') return 'admin';
    if (home === '/partner') return 'partner';
    if (home === '/rider') return 'rider';
  }
  return profile ? 'customer' : 'guest';
}
