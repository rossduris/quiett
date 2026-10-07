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

/**
 * Beta demo plans, shown on the paywall only while RevenueCat is off (REVENUECAT_ENABLED = false
 * in src/lib/dev-flags.ts). Display only: nothing is sold, the CTA is "Enter beta".
 *
 * TODO: placeholder, replace with App Store prices. Once RevenueCat is on, the real prices come
 * from App Store Connect and these are never shown.
 */
export const BETA_DEMO_PRICES = [
  { id: 'annual', title: 'Annual', price: '$29.99', per: 'year', perMonth: '$2.50/mo', best: true },
  { id: 'monthly', title: 'Monthly', price: '$4.99', per: 'month', perMonth: null, best: false },
] as const;
export const BETA_DEMO_TRIAL = '3 days';
