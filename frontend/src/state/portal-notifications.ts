import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

export type ReadPortalRequests = Record<string, string[]>;

export function readPortalRequests(key: string): ReadPortalRequests {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return {};
      raw = window.localStorage.getItem(key);
    } else {
      const file = new File(Paths.document, `${key}.json`);
      const backup = new File(Paths.document, `${key}.backup`);
      if (file.exists) raw = file.textSync();
      else if (backup.exists) raw = backup.textSync();
    }
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(value => typeof value === 'string')));
  } catch {
    return {};
  }
}

export function savePortalRequests(key: string, state: ReadPortalRequests) {
  try {
    const raw = JSON.stringify(state);
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, raw);
      return;
    }
    const current = new File(Paths.document, `${key}.json`);
    const pending = new File(Paths.document, `${key}.pending`);
    const backup = new File(Paths.document, `${key}.backup`);
    pending.write(raw);
    if (current.exists) {
      if (backup.exists) backup.delete();
      current.rename(`${key}.backup`);
    }
    pending.rename(`${key}.json`);
    if (backup.exists) backup.delete();
  } catch {
    // Badges still clear for the current session if local persistence is unavailable.
  }
}
