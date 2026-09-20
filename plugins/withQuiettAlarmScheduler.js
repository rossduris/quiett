const {
  AndroidConfig,
  createRunOncePlugin,
  IOSConfig,
  PluginError,
  withAndroidManifest,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const pkg = require('react-native-alarm-scheduler/package.json');
const silentSoundPath = path.join(
  path.dirname(require.resolve('react-native-alarm-scheduler/package.json')),
  'assets',
  'alarm-scheduler-silence.caf',
);

/**
 * Fixed wrapper around react-native-alarm-scheduler's config plugin.
 * Upstream passes modResults.manifest into Permissions.addPermission, but Expo's
 * helper expects the full AndroidManifest object ({ manifest: { "uses-permission": ... } }).
 */
const withQuiettAlarmScheduler = (config, props = {}) => {
  const alarmKitUsageDescription =
    props.alarmKitUsageDescription ||
    'Allow this app to schedule alarms that can alert you at the selected time.';
  const addExactAlarmPermission = props.addExactAlarmPermission !== false;
  const addNotificationPermission = props.addNotificationPermission !== false;
  const addUseExactAlarmPermission = props.addUseExactAlarmPermission === true;
  const iosAlarmSounds = normalizeIosAlarmSounds(props.iosAlarmSounds);

  config = withAndroidManifest(config, (modConfig) => {
    // CRITICAL: pass modResults (full doc), not modResults.manifest
    const androidManifest = modConfig.modResults;
    if (addExactAlarmPermission) {
      AndroidConfig.Permissions.addPermission(
        androidManifest,
        'android.permission.SCHEDULE_EXACT_ALARM',
      );
    }
    if (addNotificationPermission) {
      AndroidConfig.Permissions.addPermission(
        androidManifest,
        'android.permission.POST_NOTIFICATIONS',
      );
    }
    if (addUseExactAlarmPermission) {
      AndroidConfig.Permissions.addPermission(
        androidManifest,
        'android.permission.USE_EXACT_ALARM',
      );
    }
    AndroidConfig.Permissions.addPermission(
      androidManifest,
      'com.android.alarm.permission.SET_ALARM',
    );
    return modConfig;
  });

  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.NSAlarmKitUsageDescription = alarmKitUsageDescription;
    modConfig.modResults.NSSupportsLiveActivities = true;
    return modConfig;
  });

  config = withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const projectRoot = modConfig.modRequest.projectRoot;
    const platformProjectRoot = modConfig.modRequest.platformProjectRoot;
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'Resources');
    const sounds = [
      { absolutePath: silentSoundPath, label: 'bundled silent alarm sound' },
      ...iosAlarmSounds.map((sound) => ({
        absolutePath: path.resolve(projectRoot, sound),
        label: sound,
      })),
    ];

    sounds.forEach(({ absolutePath, label }) => {
      if (!fs.existsSync(absolutePath)) {
        throw new PluginError(`Alarm sound file does not exist: ${label}`, pkg.name);
      }

      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.relative(platformProjectRoot, absolutePath),
        groupName: 'Resources',
        project,
        isBuildFile: true,
        verbose: true,
      });
    });

    return modConfig;
  });

  return config;
};

function normalizeIosAlarmSounds(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new PluginError('iosAlarmSounds must be an array of file paths.', 'quiett');
  }
  return value;
}

module.exports = createRunOncePlugin(
  withQuiettAlarmScheduler,
  'withQuiettAlarmScheduler',
  '1.0.0',
);
