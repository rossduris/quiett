import { Alert, Linking, Platform } from 'react-native';
import { SUPPORT_EMAIL } from '@/constants/legal';
import { appVersionLabel } from '@/lib/app-version';

/** Opens a support email with the app version, build and OS pre-filled. */
export async function contactSupport(): Promise<void> {
  const subject = 'Quiett support';
  const body = `\n\n—\n${appVersionLabel()}\n${Platform.OS === 'ios' ? 'iOS' : Platform.OS} ${String(Platform.Version)}`;
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('No mail app found', `You can reach us at ${SUPPORT_EMAIL}.`);
  }
}

export function openLegalUrl(url: string): void {
  void Linking.openURL(url).catch(() => {});
}
