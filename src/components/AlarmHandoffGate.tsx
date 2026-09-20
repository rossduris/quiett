import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import AlarmScheduler from 'react-native-alarm-scheduler';
import { consumeAlarmHandoff, shouldForceSitSession } from '@/lib/os-alarm';

/**
 * On cold launch and every foreground, route into /session when AlarmKit
 * hands off (Sit button, Slide-to-stop, Watch stop) or a sticky pending wake.
 */
export function AlarmHandoffGate() {
  const router = useRouter();
  const pathname = usePathname();
  const routing = useRef(false);

  useEffect(() => {
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
      const handoff = await consumeAlarmHandoff();
      if (!alive) return;
      if (handoff || (await shouldForceSitSession())) {
        goSession();
      }
    };

    void reconcile();

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
      sub.remove();
      removeTriggered?.remove();
      removeAction?.remove();
    };
  }, [router, pathname]);

  return null;
}
