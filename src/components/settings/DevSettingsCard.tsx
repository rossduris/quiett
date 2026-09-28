import { useCallback, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { isBody3DPoseAvailable } from 'quiett-pose';
import { useThemeColors } from '@/lib/theme-provider';
import { usePremium } from '@/lib/premium-provider';
import { describeUnavailableReason } from '@/lib/purchases';
import { COVER_STYLES, setCoverStyle, useCoverStyle } from '@/lib/scene-cover-pref';
import { setDevFlag, useDevFlag } from '@/lib/dev-flags';
import {
  POSE_DETECTOR_LABELS,
  POSE_DETECTOR_MODES,
  setPoseDebugOverlay,
  setPoseDetectorMode,
  usePoseDebugOverlay,
  usePoseDetectorMode,
} from '@/lib/pose-dev-pref';
import {
  DEFAULT_SIT_MINUTES,
  SIT_MINUTE_OPTIONS,
  loadSitMinutes,
  saveOnboardingComplete,
  saveSitMinutes,
  type SitMinutes,
} from '@/lib/storage';
import { SettingsCard } from './SettingsCard';
import { SettingsLinkRow } from './SettingsLinkRow';
import { SettingsSwitchRow } from './SettingsSwitchRow';
import { PillGroup } from './PillGroup';
import { createSettingsStyles } from './settings-styles';

/** Developer tools. Rendered only in __DEV__ (settings.tsx); every pref here is ignored in release. */
export function DevSettingsCard() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const premium = usePremium();
  const devShowGuided = useDevFlag('showGuided');
  const devVoiceGuides = useDevFlag('voiceGuides');
  const devAccountUi = useDevFlag('accountUi');
  const coverStyle = useCoverStyle();
  const poseDetectorMode = usePoseDetectorMode();
  const poseDebugOverlay = usePoseDebugOverlay();
  const body3DAvailable = useMemo(() => isBody3DPoseAvailable(), []);
  const [sitMinutes, setSitMinutes] = useState<SitMinutes>(DEFAULT_SIT_MINUTES);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadSitMinutes().then((m) => {
        if (alive) setSitMinutes(m);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const sitOptions = useMemo(
    () =>
      SIT_MINUTE_OPTIONS.map((m) => ({
        value: m,
        label: m === 0.5 ? '30s' : `${m}m`,
        accessibilityLabel: m === 0.5 ? '30 seconds' : `${m} minutes`,
      })),
    [],
  );

  return (
    <SettingsCard label="Developer">
      <Text style={styles.hint}>Unlock length (release builds are locked to 2 minutes)</Text>
      <PillGroup
        options={sitOptions}
        selected={sitMinutes}
        onSelect={(m) => {
          setSitMinutes(m);
          void saveSitMinutes(m);
        }}
      />
      <SettingsLinkRow
        icon="refresh-outline"
        label="Replay onboarding (dev)"
        onPress={() => {
          void (async () => {
            await saveOnboardingComplete(false);
            if (router.canDismiss()) router.dismissAll();
            router.replace('/onboarding');
          })();
        }}
      />
      <SettingsSwitchRow
        icon="sparkles-outline"
        label="Force premium (dev)"
        value={premium.devForcePremium}
        onChange={(on) => void premium.setDevForcePremium(on)}
      />
      <SettingsSwitchRow
        icon="person-outline"
        label="Show guided shelf (dev)"
        value={devShowGuided}
        onChange={(on) => void setDevFlag('showGuided', on)}
      />
      <SettingsSwitchRow
        icon="mic-outline"
        label="Voice guides (dev)"
        value={devVoiceGuides}
        onChange={(on) => void setDevFlag('voiceGuides', on)}
      />
      {devVoiceGuides ? (
        <Text style={styles.hint}>
          Pick a voice in Library → Voice (dev). It plays over your sound during the meditation.
        </Text>
      ) : null}
      <SettingsSwitchRow
        icon="person-circle-outline"
        label="Account row on Profile (dev)"
        value={devAccountUi}
        onChange={(on) => void setDevFlag('accountUi', on)}
      />
      <Text style={styles.hint}>Cover style (dev)</Text>
      <PillGroup
        options={COVER_STYLES.map((cs) => ({ value: cs, label: cs === 'scenes' ? 'Scenes' : 'Classic' }))}
        selected={coverStyle}
        onSelect={(cs) => void setCoverStyle(cs)}
      />
      <SettingsLinkRow
        icon="grid-outline"
        label="Cover gallery (dev)"
        onPress={() => router.push('/cover-gallery' as Href)}
      />
      <Text style={styles.hint}>Pose detector (dev)</Text>
      <PillGroup
        options={POSE_DETECTOR_MODES.map((m) => ({ value: m, label: POSE_DETECTOR_LABELS[m] }))}
        selected={poseDetectorMode}
        onSelect={(m) => void setPoseDetectorMode(m)}
      />
      {poseDetectorMode === 'body3d' && !body3DAvailable ? (
        <Text style={styles.hint}>3D body pose needs iOS 17 and a native rebuild — falls back to 2D body.</Text>
      ) : null}
      <SettingsSwitchRow
        icon="body-outline"
        label="Pose debug overlay (dev)"
        value={poseDebugOverlay}
        onChange={(on) => void setPoseDebugOverlay(on)}
      />
      <Text style={styles.hint}>
        RevenueCat:{' '}
        {premium.available
          ? premium.offerings
            ? `ready · offering "${premium.offerings.identifier}" (${premium.offerings.availablePackages.length} packages)`
            : 'ready · no current offering yet'
          : premium.unavailableReason
            ? describeUnavailableReason(premium.unavailableReason)
            : 'unavailable'}
      </Text>
    </SettingsCard>
  );
}
