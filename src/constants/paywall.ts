/**
 * Paywall switches.
 *
 * PAYWALL_DISMISSABLE: soft vs hard paywall.
 * - true (soft): a "Not now" link on the onboarding paywall, and no app-level gate.
 * - false (hard, current): no "Not now". Onboarding only moves on after a purchase or restore
 *   with `premium` active, and the tabs (Home / Library / Profile) show the paywall gate to
 *   anyone without Premium, signed in or not (see src/lib/access-gate.ts). Sign-in is optional;
 *   purchases work on the anonymous RevenueCat customer. The wake flow (/session, /emergency,
 *   /success) is never gated.
 */
export const PAYWALL_DISMISSABLE = false;

/**
 * TestFlight escape hatch for the hard paywall.
 * When plans can't load (products not in App Store Connect yet, RevenueCat misconfigured,
 * offline) and this is true, the onboarding paywall shows "Continue" and the app-level gate
 * lets people in, so testers are never hard-blocked. When false, the paywall only offers
 * "Try again".
 *
 * TODO(before App Store release): set this to false (or change it to `__DEV__`) once the
 * subscriptions are live in App Store Connect and RevenueCat offerings load. Leaving it true
 * in a release build means anyone who can't load plans (e.g. offline) gets in for free.
 */
export const PAYWALL_ALLOW_CONTINUE_WHEN_PLANS_UNAVAILABLE = true;
