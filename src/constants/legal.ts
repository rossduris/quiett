/**
 * Legal + support links (Settings → Legal / Help, the paywall and the subscription screen).
 *
 * TODO(before App Review): fill in every value marked PLACEHOLDER below.
 *  - PRIVACY_POLICY_URL: the real hosted policy (App Store Connect needs the same URL in
 *    App Privacy settings).
 *  - SUPPORT_EMAIL: the inbox for Settings → Help → Contact support.
 *  - TERMS_OF_USE_URL: Apple's standard EULA is valid as-is; replace only if Quiett adopts
 *    its own terms.
 * Dev builds log a warning on launch while any placeholder is still in use.
 */
export const TERMS_OF_USE_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** PLACEHOLDER (TODO): replace with the real hosted privacy policy URL. */
export const PRIVACY_POLICY_URL = 'https://example.com/quiett/privacy';

/** PLACEHOLDER (TODO): replace with the real support inbox. */
export const SUPPORT_EMAIL = 'support@example.com';

const PLACEHOLDERS: { name: string; value: string }[] = [
  { name: 'PRIVACY_POLICY_URL', value: PRIVACY_POLICY_URL },
  { name: 'SUPPORT_EMAIL', value: SUPPORT_EMAIL },
];

/** True while a value still points at the example.com placeholder. */
export function isPlaceholder(value: string): boolean {
  return /example\.com/i.test(value);
}

/** Dev-only console warning listing placeholders that still need real values. */
export function warnIfLegalPlaceholders(): void {
  if (!__DEV__) return;
  const missing = PLACEHOLDERS.filter((p) => isPlaceholder(p.value)).map((p) => p.name);
  if (missing.length > 0) {
    console.warn(`[legal] Placeholder still in use (src/constants/legal.ts): ${missing.join(', ')}`);
  }
}

/** Apple-required auto-renewing subscription disclosure (shown near purchase + manage). */
export const SUBSCRIPTION_TERMS = [
  'Payment is charged to your Apple ID account at confirmation of purchase.',
  'Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the period ends.',
  'You can manage or cancel your subscription anytime in your App Store account settings.',
] as const;
