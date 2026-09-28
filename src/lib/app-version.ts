import * as Application from 'expo-application';
import Constants from 'expo-constants';

/** App version + build from the native bundle (falls back to app.json in Expo Go / web). */
export function appVersion(): { version: string; build: string | null } {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—';
  const build = Application.nativeBuildVersion ?? null;
  return { version, build };
}

/** e.g. "Quiett 1.0.0 (build 12)". */
export function appVersionLabel(): string {
  const { version, build } = appVersion();
  return build ? `Quiett ${version} (build ${build})` : `Quiett ${version}`;
}
