import { useEffect, useState } from 'react';
import {
  PAYWALL_ALLOW_CONTINUE_WHEN_PLANS_UNAVAILABLE,
  PAYWALL_DISMISSABLE,
} from '@/constants/paywall';
import { useAuth } from '@/lib/auth-provider';
import { setOsAlarmSchedulingBlocked } from '@/lib/os-alarm';
import { usePremium } from '@/lib/premium-provider';

/**
 * App-level access gate (hard paywall). Sign-in is optional, so this is a Premium check only:
 * it works the same for an anonymous RevenueCat customer and a signed-in one.
 *
 * Applied ONLY by the tabs layout (Home / Library / Profile). It renders inline in place of the
 * tabs and never navigates, so it can't pull anyone out of the wake flow: /session, /emergency,
 * /success, /test-morning and AlarmHandoffGate's routing are untouched. A wake that cold-launches
 * into the tabs still gets replaced to /session by AlarmHandoffGate as before.
 *
 *  - 'checking': waiting for the Supabase session, or for RevenueCat to answer for the current
 *    app user (blank background, no paywall flash for subscribers).
 *  - 'paywall':  Premium known to be inactive, plans available (or the TestFlight escape hatch
 *    is off).
 *  - 'open':     show the app.
 */
export type AccessGateState = 'checking' | 'paywall' | 'open';

/** Upper bound on the launch wait for RevenueCat before deciding with what we have. */
const MAX_WAIT_MS = 6000;
/** A RevenueCat answer older than this (by its server request date) is too stale to block alarms on. */
const FRESH_ANSWER_MS = 15 * 60 * 1000;

/** Plans can't load and the TestFlight escape hatch lets people through anyway. */
export function useEscapeHatchOpen(): boolean {
  const { plansUnavailable } = usePremium();
  return PAYWALL_ALLOW_CONTINUE_WHEN_PLANS_UNAVAILABLE && plansUnavailable;
}

export type AccessDecision = {
  state: AccessGateState;
  /**
   * The gate shows the paywall AND that rests on a real answer: RevenueCat is synced to the
   * current app user (anonymous or signed in), finished loading and said "no Premium", with no
   * escape hatch. False for every doubtful case (still loading, offline, gave up waiting), so
   * callers that act on it (alarm scheduling) never punish a subscriber for a slow load.
   */
  blockedForSure: boolean;
};

export function useAccessGate(): AccessGateState {
  return useAccessDecision().state;
}

export function useAccessDecision(): AccessDecision {
  const auth = useAuth();
  const premium = usePremium();
  const escapeHatch = useEscapeHatchOpen();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const unsure = (state: AccessGateState): AccessDecision => ({ state, blockedForSure: false });

  // The session decides which RevenueCat customer counts (PurchasesUserSync waits for it too).
  if (auth.loading) return unsure('checking');

  // Soft paywall, or no App Store on this platform: nothing to gate.
  if (PAYWALL_DISMISSABLE || premium.unavailableReason === 'unsupported-platform') return unsure('open');
  if (premium.isPremium) return unsure('open');

  // null = anonymous. RevenueCat must be synced to the current app user before its answer
  // counts (right after sign-in / sign-out it still holds the previous customer).
  const userId = auth.user?.id ?? null;
  const synced = !premium.available || premium.purchasesUserId === userId;
  const waiting = premium.loading || !synced;

  if (waiting && !timedOut) {
    // Subscriber last time: open now, re-checked the moment RevenueCat answers.
    return unsure(premium.lastKnownPremium === true ? 'open' : 'checking');
  }
  // No real answer (offline / RevenueCat error / gave up waiting): trust the last known state.
  if ((waiting || !premium.entitlementKnown) && premium.lastKnownPremium === true) return unsure('open');
  if (escapeHatch) return unsure('open');
  return {
    state: 'paywall',
    blockedForSure: !waiting && premium.available && premium.entitlementKnown,
  };
}

/**
 * Mirrors the gate's decision into os-alarm so syncOsAlarm doesn't (re)schedule alarms for a
 * user the gate blocks for sure. Mounted once in the root layout (so it also covers /session's
 * post-wake reschedule). Only ever blocks on a certain, fresh answer; any doubt → scheduling
 * allowed. Renders nothing.
 */
export function AlarmAccessSync() {
  const { blockedForSure } = useAccessDecision();
  const { customerInfo } = usePremium();
  const requestDate = customerInfo?.requestDate ?? null;
  useEffect(() => {
    // Extra guard: RevenueCat can hand back a stale cached customer when offline (e.g. a renewal
    // it hasn't seen yet). Only block on an answer the server produced recently.
    const at = requestDate ? Date.parse(requestDate) : NaN;
    const fresh = Number.isFinite(at) && Math.abs(Date.now() - at) < FRESH_ANSWER_MS;
    setOsAlarmSchedulingBlocked(blockedForSure && fresh);
  }, [blockedForSure, requestDate]);
  useEffect(() => () => setOsAlarmSchedulingBlocked(false), []);
  return null;
}
