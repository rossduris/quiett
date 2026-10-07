/**
 * Pure helpers that turn RevenueCat package data into paywall copy.
 * Every price and trial length shown on the paywall comes from here, read straight from the
 * StoreKit product (priceString, pricePerMonthString, introPrice). Nothing is hard-coded.
 * Only type imports from the SDK, so this file is safe on builds without the native module.
 */
import type { IntroEligibilityState, PurchasesIntroPrice, PurchasesPackage } from '@/lib/purchases';

export type PlanInfo = {
  title: string;
  /** "year", "month", "3 months"… or null for one-time purchases. */
  per: string | null;
  /** Months in one billing period, when known. */
  months: number | null;
};

const UNIT_WORDS: Record<string, string> = { D: 'day', W: 'week', M: 'month', Y: 'year' };

function plural(n: number, word: string): string {
  return n === 1 ? word : `${n} ${word}s`;
}

function parseIsoPeriod(period: string | null | undefined): { per: string; months: number | null } | null {
  if (!period) return null;
  const m = /^P(\d+)([DWMY])$/.exec(period);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!;
  const months = unit === 'Y' ? n * 12 : unit === 'M' ? n : null;
  return { per: plural(n, UNIT_WORDS[unit]!), months };
}

export function planInfo(pkg: PurchasesPackage): PlanInfo {
  // Compare as plain strings so this file never needs the SDK at runtime.
  switch (pkg.packageType as string) {
    case 'ANNUAL':
      return { title: 'Annual', per: 'year', months: 12 };
    case 'SIX_MONTH':
      return { title: '6 months', per: '6 months', months: 6 };
    case 'THREE_MONTH':
      return { title: '3 months', per: '3 months', months: 3 };
    case 'TWO_MONTH':
      return { title: '2 months', per: '2 months', months: 2 };
    case 'MONTHLY':
      return { title: 'Monthly', per: 'month', months: 1 };
    case 'WEEKLY':
      return { title: 'Weekly', per: 'week', months: null };
    case 'LIFETIME':
      return { title: 'Lifetime', per: null, months: null };
    default: {
      const parsed = parseIsoPeriod(pkg.product.subscriptionPeriod);
      return {
        title: pkg.product.title || 'Premium',
        per: parsed?.per ?? null,
        months: parsed?.months ?? null,
      };
    }
  }
}

export function isAnnual(pkg: PurchasesPackage): boolean {
  return (pkg.packageType as string) === 'ANNUAL';
}

/** Annual first, then shorter periods. */
export function sortPackages(pkgs: PurchasesPackage[]): PurchasesPackage[] {
  const order = ['ANNUAL', 'SIX_MONTH', 'THREE_MONTH', 'TWO_MONTH', 'MONTHLY', 'WEEKLY', 'LIFETIME'];
  const rank = (p: PurchasesPackage) => {
    const i = order.indexOf(p.packageType as string);
    return i === -1 ? order.length : i;
  };
  return [...pkgs].sort((a, b) => rank(a) - rank(b));
}

/** "{price}/year" style, with " per 3 months" for longer periods. */
export function priceLabel(pkg: PurchasesPackage): string {
  const info = planInfo(pkg);
  if (!info.per) return pkg.product.priceString;
  return info.per.includes(' ')
    ? `${pkg.product.priceString} per ${info.per}`
    : `${pkg.product.priceString}/${info.per}`;
}

/** Per-month equivalent for multi-month plans, straight from StoreKit (null if not provided). */
export function perMonthLabel(pkg: PurchasesPackage): string | null {
  const info = planInfo(pkg);
  if (!info.months || info.months <= 1) return null;
  const s = pkg.product.pricePerMonthString;
  return s ? `${s}/month` : null;
}

function introLength(intro: PurchasesIntroPrice): { n: number; unit: string } | null {
  const unitKey = (intro.periodUnit ?? '').toUpperCase().charAt(0);
  const unit = UNIT_WORDS[unitKey];
  const n = (intro.periodNumberOfUnits || 0) * Math.max(1, intro.cycles || 1);
  if (unit && n > 0) return { n, unit };
  const parsed = /^P(\d+)([DWMY])$/.exec(intro.period ?? '');
  if (!parsed) return null;
  return { n: Number(parsed[1]) * Math.max(1, intro.cycles || 1), unit: UNIT_WORDS[parsed[2]!]! };
}

/**
 * The StoreKit free trial on this package as words ("3 days", "1 week"), or null when there is
 * no free intro offer, or StoreKit says this Apple ID already used it.
 * 'unknown' eligibility still shows the trial: the App Store sheet has the final say.
 */
export function freeTrialLength(
  pkg: PurchasesPackage,
  eligibility: IntroEligibilityState | undefined
): string | null {
  if (eligibility === 'ineligible' || eligibility === 'no-offer') return null;
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const len = introLength(intro);
  if (!len) return null;
  return len.n === 1 ? `1 ${len.unit}` : `${len.n} ${len.unit}s`;
}

/** "3-day" for "3 days" (headline / plan card adjective form). */
export function trialAdjective(length: string): string {
  const [n, unit] = length.split(' ');
  return `${n}-${(unit ?? '').replace(/s$/, '')}`;
}

/** Disclosure under the CTA, built only from package data. */
export function trialDisclosure(pkg: PurchasesPackage, trial: string | null): string {
  const info = planInfo(pkg);
  if (!info.per) return `${pkg.product.priceString}, one-time purchase.`;
  if (trial) return `${capitalize(trial)} free, then ${priceLabel(pkg)}. Cancel anytime in Settings.`;
  return `${priceLabel(pkg)}, renews automatically. Cancel anytime in Settings.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
