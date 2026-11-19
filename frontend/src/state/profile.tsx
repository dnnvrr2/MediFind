import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ApiError, api, clearSession, onSessionCleared, hasSession, setSession, type ApiCustomer, type ApiSession } from '../api/client';

export type CustomerProfile = { id?: number; fullName: string; firstName?: string; lastName?: string; email: string; phone: string; isStaff?: boolean; pharmacyStatus?: string | null; isRider?: boolean };
type ProfileFields = { firstName: string; lastName: string; phone: string };
type RegistrationProfile = ProfileFields & Pick<CustomerProfile, 'email'>;
type ProfileResult = { ok: true; isStaff: boolean; profile: CustomerProfile } | { ok: false; issue: string };
type ProfileContext = {
  profile: CustomerProfile | null;
  ready: boolean;
  refreshProfile: (replaceAccount?: boolean) => Promise<void>;
  register: (profile: RegistrationProfile, password: string) => Promise<ProfileResult>;
  signIn: (email: string, password: string) => Promise<ProfileResult>;
  update: (profile: ProfileFields) => Promise<ProfileResult>;
  signOut: () => Promise<void>;
};
const Context = createContext<ProfileContext | null>(null);
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const validMobileNumber = (phone: string) => /^(?:09|\+639)\d{9}$/.test(phone.replace(/[\s().-]/g, ''));
export function profileFieldIssues({ firstName, lastName, phone }: ProfileFields) {
  const first = firstName.trim();
  const last = lastName.trim();
  return {
    firstNameIssue: first ? undefined : 'Enter your first name.',
    lastNameIssue: !last ? 'Enter your last name.' :
      first.length + last.length + 1 > 120 ? 'Use 120 characters or fewer for your full name.' : undefined,
    phoneIssue: !phone.trim() ? 'Enter your mobile number.' : validMobileNumber(phone) ? undefined : 'Invalid number',
  };
}
function fromApi(value: ApiCustomer): CustomerProfile {
  const [legacyFirst, ...legacyLast] = value.full_name.trim().split(/\s+/);
  const firstName = value.first_name?.trim();
  return {
    id: value.id, fullName: value.full_name, firstName: firstName || legacyFirst,
    lastName: firstName ? value.last_name?.trim() ?? '' : legacyLast.join(' '),
    email: value.email, phone: value.phone, isStaff: value.is_staff === true,
    pharmacyStatus: value.pharmacy_status, isRider: value.is_rider === true,
  };
}
const issueOf = (error: unknown) => error instanceof ApiError ? error.message : 'Could not connect to your account. Please try again.';

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onSessionCleared(() => setProfile(null)), []);
  useEffect(() => { let active = true; api.restoreSession().then(customer => { if (active && customer) setProfile(fromApi(customer)); }).catch(() => undefined).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  const refreshProfile = useCallback(async (replaceAccount = false) => { const customer = await api.me(); setProfile(previous => replaceAccount || previous?.email === customer.email ? fromApi(customer) : previous); }, []);
  async function accept(session: ApiSession) { await setSession(session); setProfile(fromApi(session.customer)); }
  return <Context.Provider value={{
    profile,
    ready,
    refreshProfile,
    register: async (value, password) => {
      if (!validMobileNumber(value.phone)) return { ok: false, issue: 'Invalid number' };
      if (password.length < 8) return { ok: false, issue: 'Use at least 8 characters for your password.' };
      try {
        const session = await api.register({ email: value.email.trim().toLowerCase(), password, first_name: value.firstName.trim(), last_name: value.lastName.trim(), phone: value.phone.trim() });
        await accept(session);
        return { ok: true, isStaff: session.customer.is_staff === true, profile: fromApi(session.customer) };
      } catch (error) { return { ok: false, issue: issueOf(error) }; }
    },
    signIn: async (email, password) => {
      if (!validEmail(email) || password.length < 8) return { ok: false, issue: 'Enter a valid email and a password with at least 8 characters.' };
      try { const session = await api.login({ email: email.trim().toLowerCase(), password }); await accept(session); return { ok: true, isStaff: session.customer.is_staff === true, profile: fromApi(session.customer) }; }
      catch (error) { return { ok: false, issue: issueOf(error) }; }
    },
    update: async value => {
      if (!hasSession()) return { ok: false, issue: 'Sign in again to update your profile.' };
      try {
        const updated = await api.updateMe({ first_name: value.firstName.trim(), last_name: value.lastName.trim(), phone: value.phone.trim() });
        setProfile(fromApi(updated));
        return { ok: true, isStaff: updated.is_staff === true, profile: fromApi(updated) };
      } catch (error) { return { ok: false, issue: issueOf(error) }; }
    },
    signOut: async () => { await api.logout(); },
  }}>{children}</Context.Provider>;
}
export function useProfile() {
  const value = useContext(Context);
  if (!value) throw new Error('ProfileProvider missing');
  return value;
}
