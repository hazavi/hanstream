import { isDesktop, nativeInvoke } from './native';
import { validateProfile } from './profile-transfer';
import type { UserProfile } from './types';

const KEY = 'hanstream-local-profile';
let queue = Promise.resolve();

export async function loadSavedProfile(): Promise<UserProfile | null> {
  if (isDesktop()) {
    const saved = await nativeInvoke<unknown>('library_load');
    if (saved) return validateProfile(saved);
  }
  const text = localStorage.getItem(KEY);
  if (!text) return null;
  const profile = validateProfile(JSON.parse(text));
  if (isDesktop()) {
    await nativeInvoke('library_save', { profile });
    localStorage.removeItem(KEY);
  }
  return profile;
}

export function saveProfile(profile: UserProfile): Promise<void> {
  const next = queue.then(async () => {
    if (isDesktop()) await nativeInvoke('library_save', { profile });
    else localStorage.setItem(KEY, JSON.stringify(profile));
  });
  queue = next.catch(() => {});
  return next;
}

export function clearSavedProfile(): Promise<void> {
  const next = queue.then(async () => {
    if (isDesktop()) await nativeInvoke('library_clear');
    localStorage.removeItem(KEY);
  });
  queue = next.catch(() => {});
  return next;
}
