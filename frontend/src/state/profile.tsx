import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ApiError, api, clearSession, hasSession, setSession, type ApiCustomer, type ApiSession } from '../api/client';

export type CustomerProfile = { fullName: string; email: string; phone: string };
type ProfileResult = { ok: true } | { ok: false; issue: string };
type ProfileContext = {
  profile: CustomerProfile | null;
  ready: boolean;
  register: (profile: CustomerProfile, password: string) => Promise<ProfileResult>;
  signIn: (email: string, password: string) => Promise<ProfileResult>;
  update: (profile: CustomerProfile) => Promise<ProfileResult>;
  signOut: () => Promise<void>;
};
const Context = createContext<ProfileContext | null>(null);
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validProfile = (profile: CustomerProfile) => profile.fullName.trim().length >= 2 && validEmail(profile.email) && (!profile.phone.trim() || /^09\d{9}$|^\+639\d{9}$/.test(profile.phone.trim().replace(/[\s().-]/g, '')));
const fromApi = (value: ApiCustomer): CustomerProfile => ({ fullName: value.full_name, email: value.email, phone: value.phone });
const issueOf = (error: unknown) => error instanceof ApiError ? error.message : 'Could not connect to your account. Please try again.';

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { let active = true; api.restoreSession().then(customer => { if (active && customer) setProfile(fromApi(customer)); }).catch(() => undefined).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  async function accept(session: ApiSession) { await setSession(session); setProfile(fromApi(session.customer)); }
  return <Context.Provider value={{
    profile,
    ready,
    register: async (value, password) => {
      if (!validProfile(value)) return { ok: false, issue: 'Check the name, email, and mobile number.' };
      if (password.length < 8) return { ok: false, issue: 'Use at least 8 characters for your password.' };
      try {
        const session = await api.register({ email: value.email.trim().toLowerCase(), password, full_name: value.fullName.trim(), phone: value.phone.trim() });
        await accept(session);
        return { ok: true };
      } catch (error) { return { ok: false, issue: issueOf(error) }; }
    },
    signIn: async (email, password) => {
      if (!validEmail(email) || password.length < 8) return { ok: false, issue: 'Enter a valid email and a password with at least 8 characters.' };
      try { const session = await api.login({ email: email.trim().toLowerCase(), password }); await accept(session); return { ok: true }; }
      catch (error) { return { ok: false, issue: issueOf(error) }; }
    },
    update: async value => {
      if (!validProfile(value)) return { ok: false, issue: 'Check the name, email, and mobile number.' };
      if (!hasSession()) return { ok: false, issue: 'Sign in again to update your profile.' };
      try {
        const updated = await api.updateMe({ full_name: value.fullName.trim(), phone: value.phone.trim() });
        setProfile(fromApi(updated));
        return { ok: true };
      } catch (error) { return { ok: false, issue: issueOf(error) }; }
    },
    signOut: async () => { await api.logout(); await clearSession(); setProfile(null); },
  }}>{children}</Context.Provider>;
}
export function useProfile() {
  const value = useContext(Context);
  if (!value) throw new Error('ProfileProvider missing');
  return value;
}
