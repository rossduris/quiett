import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Local profile identity: display name + photo. No account — stored on this device only.
// The photo is copied into the app's document directory (`profile/avatar-<ts>.jpg`); we store
// only the file name, because the absolute container path can change across app updates.
// ---------------------------------------------------------------------------

const KEY_NAME = 'quiett.profileName';
const KEY_PHOTO = 'quiett.profilePhoto';
const PHOTO_DIR = 'profile';

export const NAME_MIN = 1;
export const NAME_MAX = 24;

export type ProfileIdentity = {
  name: string | null;
  /** file:// URI of the saved photo in the document directory, or null. */
  photoUri: string | null;
};

const EMPTY: ProfileIdentity = { name: null, photoUri: null };

/** Trim, collapse inner whitespace, strip control characters. */
export function normalizeName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Null when valid, otherwise a short, friendly reason. Empty clears the name (allowed). */
export function validateName(raw: string): string | null {
  const name = normalizeName(raw);
  if (name.length === 0) return null;
  if (name.length > NAME_MAX) return `Keep it to ${NAME_MAX} characters or fewer.`;
  if (!/[\p{L}\p{N}]/u.test(name)) return 'Use at least one letter or number.';
  return null;
}

/** First name for greetings ("Ross Duris" → "Ross"). */
export function firstName(name: string | null | undefined): string | null {
  const n = name ? normalizeName(name) : '';
  return n ? n.split(' ')[0] ?? n : null;
}

/** Up to two initials for the fallback avatar. */
export function initialsFor(name: string | null | undefined): string {
  const n = name ? normalizeName(name) : '';
  if (!n) return '';
  const parts = n.split(' ').filter(Boolean);
  const chars = parts.length > 1 ? [parts[0]!, parts[parts.length - 1]!] : [parts[0]!];
  return chars.map((p) => Array.from(p)[0] ?? '').join('').toUpperCase();
}

/** "Good morning" / "Good afternoon" / "Good evening" (+ ", Ross" when a name is set). */
export function greetingFor(now: Date, name: string | null | undefined): string {
  const h = now.getHours();
  const part = h >= 4 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening';
  const first = firstName(name);
  return first ? `${part}, ${first}` : part;
}

function photoDir(): Directory {
  return new Directory(Paths.document, PHOTO_DIR);
}

function photoFileFromName(fileName: string): File {
  return new File(photoDir(), fileName);
}

export async function loadProfileIdentity(): Promise<ProfileIdentity> {
  try {
    const [[, name], [, photo]] = await AsyncStorage.multiGet([KEY_NAME, KEY_PHOTO]);
    let photoUri: string | null = null;
    if (photo) {
      try {
        const f = photoFileFromName(photo);
        if (f.exists) photoUri = f.uri;
      } catch {
        photoUri = null;
      }
    }
    const n = name ? normalizeName(name) : '';
    return { name: n || null, photoUri };
  } catch {
    return { ...EMPTY };
  }
}

// ── Tiny store so Home + Profile update together ────────────────────────────

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export async function saveProfileName(raw: string): Promise<void> {
  const name = normalizeName(raw);
  if (validateName(name)) throw new Error(validateName(name) ?? 'invalid name');
  if (name) await AsyncStorage.setItem(KEY_NAME, name);
  else await AsyncStorage.removeItem(KEY_NAME);
  notify();
}

function deleteOldPhotos(keep: string | null) {
  try {
    const dir = photoDir();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name !== keep) {
        try {
          entry.delete();
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

/** Copy a picked image (temp/cache URI) into the document directory and make it the photo. */
export async function saveProfilePhotoFrom(sourceUri: string): Promise<void> {
  const dir = photoDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const ext = /\.(png|heic|jpe?g|webp)$/i.exec(sourceUri)?.[1]?.toLowerCase() ?? 'jpg';
  // New name each time so expo-image doesn't show a cached old photo.
  const fileName = `avatar-${Date.now()}.${ext}`;
  const dest = photoFileFromName(fileName);
  new File(sourceUri).copy(dest);
  await AsyncStorage.setItem(KEY_PHOTO, fileName);
  deleteOldPhotos(fileName);
  notify();
}

export async function removeProfilePhoto(): Promise<void> {
  await AsyncStorage.removeItem(KEY_PHOTO);
  deleteOldPhotos(null);
  notify();
}

export type PickPhotoResult =
  | { status: 'picked'; uri: string }
  | { status: 'canceled' }
  | { status: 'unavailable' };

/**
 * Open the photo library (square crop). expo-image-picker is a native module; on a build made
 * before it was added the module is missing, so require it lazily and report `unavailable`
 * instead of crashing.
 */
export async function pickProfilePhoto(): Promise<PickPhotoResult> {
  let picker: typeof import('expo-image-picker');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    picker = require('expo-image-picker') as typeof import('expo-image-picker');
  } catch {
    return { status: 'unavailable' };
  }
  try {
    const result = await picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return { status: 'canceled' };
    return { status: 'picked', uri: result.assets[0].uri };
  } catch (e) {
    console.warn('[quiett profile] pick photo', e);
    return { status: 'unavailable' };
  }
}

/** Current identity; reloads on focus and whenever it's saved anywhere. */
export function useProfileIdentity(): ProfileIdentity & { loaded: boolean } {
  const [state, setState] = useState<ProfileIdentity & { loaded: boolean }>({ ...EMPTY, loaded: false });
  const reload = useCallback(() => {
    void loadProfileIdentity().then((id) => setState({ ...id, loaded: true }));
  }, []);
  useEffect(() => {
    listeners.add(reload);
    return () => {
      listeners.delete(reload);
    };
  }, [reload]);
  useFocusEffect(reload);
  return state;
}
