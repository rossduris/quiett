/**
 * Legal links shown on the paywall and the subscription screen.
 *
 * TODO(privacy/terms round): replace PRIVACY_POLICY_URL with the real hosted policy, and
 * TERMS_OF_USE_URL with custom terms if Quiett adopts its own (Apple's standard EULA is valid
 * until then). App Store Connect needs the same privacy URL in App Privacy settings.
 */
export const TERMS_OF_USE_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// TODO: placeholder — replace before submitting to App Review.
export const PRIVACY_POLICY_URL = 'https://example.com/quiett/privacy';

/** Apple-required auto-renewing subscription disclosure (shown near purchase + manage). */
export const SUBSCRIPTION_TERMS = [
  'Payment is charged to your Apple ID account at confirmation of purchase.',
  'Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the period ends.',
  'You can manage or cancel your subscription anytime in your App Store account settings.',
] as const;
