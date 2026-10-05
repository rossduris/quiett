import { useEffect, useLayoutEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import AlarmScheduler from 'react-native-alarm-scheduler';
import { consumeAlarmHandoff, shouldForceSitSession } from '@/lib/os-alarm';

/**
 * On cold launch and every foreground, route into /session when AlarmKit
 * hands off (Stop, Settle in, Watch stop), the Live Activity / alert body is
 * tapped while alerting, or a *fresh* sticky pending wake exists.
 *
 * Waits for the root navigator and retries briefly: Home cold-start used to
 * cancel+reschedule the OS alarm in parallel, which can clear the native handoff
 * before the first reconcile finishes (see syncOsAlarm live-wake guard).
 *
 * Never bounces out of /emergency or /success — those screens mean the morning
 * is already resolved (or resolving); a stale sticky must not reopen the camera.
 *
 * Mounted in root `_layout` ABOVE the Stack so it wins over Home focus sync.
 */
export function AlarmHandoffGate() {
  const router = useRouter();
  const pathname = usePathname();
  const navState = useRootNavigationState();
  const routing = useRef(false);
  const pathnameRef = useRef(pathname);
  useLayoutEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    // expo-router: replace before the root nav key exists can no-op on cold start.
    if (!navState?.key) return;

    let alive = true;

    const onTerminalPath = (path: string | undefined) =>
      Boolean(path && (path.includes('emergency') || path.includes('success')));

    const goSession = (reason: string) => {
      const path = pathnameRef.current;
      if (routing.current) {
        if (__DEV__) console.log('[quiett wake] route-to-session skipped (in-flight)', { reason, path });
        return;
      }
      if (path?.includes('session')) {
        if (__DEV__) console.log('[quiett wake] route-to-session skipped (already session)', { reason });
        return;
      }
      if (onTerminalPath(path)) {
        if (__DEV__) console.log('[quiett wake] route-to-session skipped (terminal)', { reason, path });
        return;
      }
      routing.current = true;
      if (__DEV__) console.log('[quiett wake] route-to-session', { reason, path });
      try {
        router.replace('/session');
      } finally {
        setTimeout(() => {
          routing.current = false;
        }, 1500);
      }
    };

    const reconcile = async (source: string) => {
      // consume first (sets sticky from Stop / Settle in / alerting), then force check
      // covers LA body tap with no recorded Stop/secondary intent.
      const handoff = await consumeAlarmHandoff();
      if (!alive) return;
      if (handoff) {
        goSession(`${source}:handoff:${handoff.action ?? 'unknown'}`);
        return;
      }
      const force = await shouldForceSitSession();
      if (!alive) return;
      if (force) {
        goSession(`${source}:force`);
      } else if (__DEV__) {
        console.log('[quiett wake] route-to-session decided no', { source, path: pathnameRef.current });
      }
    };

    void reconcile('mount');
    // Second chances if the first replace raced the navigator or Home focus.
    const t1 = setTimeout(() => {
      if (alive) void reconcile('retry-400');
    }, 400);
    const t2 = setTimeout(() => {
      if (alive) void reconcile('retry-1200');
    }, 1200);
    // Late cold-start: Home sync + native handoff settle can take >1s on launch.
    const t3 = setTimeout(() => {
      if (alive) void reconcile('retry-2500');
    }, 2500);

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void reconcile('foreground');
    };
    const sub = AppState.addEventListener('change', onChange);

    // Live events when JS is already awake
    let removeTriggered: { remove: () => void } | undefined;
    let removeAction: { remove: () => void } | undefined;
    try {
      removeTriggered = AlarmScheduler.addListener('onAlarmTriggered', () => {
        void reconcile('onAlarmTriggered');
      });
      removeAction = AlarmScheduler.addListener('onAlarmAction', () => {
        void reconcile('onAlarmAction');
      });
    } catch {
      /* native module may be unavailable on web */
    }

    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      sub.remove();
      removeTriggered?.remove();
      removeAction?.remove();
    };
    // pathname is read via ref so leaving /session for /emergency does not
    // rebuild the retry loop (which used to bounce the user back into /session).
  }, [router, navState?.key]);

  return null;
}
