import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { parseSavedCart, type CartItem } from '../domain/cart';

const retiredPharmacies = new Set(['healthplus', 'rika', 'mercury']);

export const savedCartKey = (accountId: string) => `medifind.cart.v1.${encodeURIComponent(accountId)}`;

export function readSavedCart(key: string): CartItem[] {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(key);
    if (raw === null) return [];
    const items = parseSavedCart(raw);
    if (items) return items.filter(item => !retiredPharmacies.has(item.pharmacyId));
  } else {
    const current = new File(Paths.document, key + '.json');
    const backup = new File(Paths.document, key + '.backup');
    if (!current.exists && !backup.exists) return [];
    const items = (current.exists ? parseSavedCart(current.textSync()) : null) ??
      (backup.exists ? parseSavedCart(backup.textSync()) : null);
    if (items) return items.filter(item => !retiredPharmacies.has(item.pharmacyId));
  }
  throw new Error('Saved cart could not be read.');
}

export function saveCart(key: string, items: CartItem[]) {
  const raw = JSON.stringify(items);
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, raw);
    return;
  }

  const current = new File(Paths.document, key + '.json');
  const pending = new File(Paths.document, key + '.pending');
  const backup = new File(Paths.document, key + '.backup');
  // Stage the new file before touching the last committed cart.
  pending.write(raw);
  if (current.exists) {
    if (backup.exists) backup.delete();
    current.rename(key + '.backup');
  }
  pending.rename(key + '.json');
  if (backup.exists) backup.delete();
}
