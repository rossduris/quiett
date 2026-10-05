import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import AlarmScheduler from 'react-native-alarm-scheduler';
import { consumeAlarmHandoff, shouldForceSitSession } from '@/lib/os-alarm';

/**
 * On cold launch and every foreground, route into /session when AlarmKit
 * hands off (Stop, Settle in, Watch stop), the Live Activity / alert body is
 * tapped while alerting, or a sticky pending wake exists.
 *
 * Waits for the root navigator and retries briefly: Home cold-start used to
 * cancel+reschedule the OS alarm in parallel, which can clear the native handoff
 * before the first reconcile finishes (see syncOsAlarm live-wake guard).
 *
 * Mounted in root `_layout` ABOVE the Stack so it wins over Home focus sync.
 */
export function AlarmHandoffGate() {
  const router = useRouter();
  const pathname = usePathname();
  const navState = useRootNavigationState();
  const routing = useRef(false);

  useEffect(() => {
    // expo-router: replace before the root nav key exists can no-op on cold start.
    if (!navState?.key) return;

    let alive = true;

    const goSession = () => {
      if (routing.current) return;
      if (pathname?.includes('session')) return;
      routing.current = true;
      try {
        router.replace('/session');
      } finally {
        setTimeout(() => {
          routing.current = false;
        }, 1500);
      }
    };

    const reconcile = async () => {
      // consume first (sets sticky from Stop / Settle in / alerting), then force check
      // covers LA body tap with no recorded Stop/secondary intent.
      const handoff = await consumeAlarmHandoff();
      if (!alive) return;
      const force = handoff ? true : await shouldForceSitSession();
      if (!alive) return;
      if (handoff || force) {
        goSession();
      }
    };

    void reconcile();
    // Second chances if the first replace raced the navigator or Home focus.
    const t1 = setTimeout(() => {
      if (alive) void reconcile();
    }, 400);
    const t2 = setTimeout(() => {
      if (alive) void reconcile();
    }, 1200);
    // Late cold-start: Home sync + native handoff settle can take >1s on launch.
    const t3 = setTimeout(() => {
      if (alive) void reconcile();
    }, 2500);

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void reconcile();
    };
    const sub = AppState.addEventListener('change', onChange);

    // Live events when JS is already awake
    let removeTriggered: { remove: () => void } | undefined;
    let removeAction: { remove: () => void } | undefined;
    try {
      removeTriggered = AlarmScheduler.addListener('onAlarmTriggered', () => {
        void reconcile();
      });
      removeAction = AlarmScheduler.addListener('onAlarmAction', () => {
        void reconcile();
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
  }, [router, pathname, navState?.key]);

  return null;
}
