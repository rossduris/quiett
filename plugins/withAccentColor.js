const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Adds an AccentColor colour set to the iOS asset catalog and points
 * ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME at it, so SwiftUI's `Color.accentColor`
 * resolves to the Quiett brand colour instead of system blue. react-native-alarm-scheduler
 * passes `Color.accentColor` as the AlarmKit tint (lock screen alert buttons / Live Activity).
 *
 * Props: { color: '#RRGGBB', darkColor?: '#RRGGBB' }
 */
function hexToComponents(hex) {
  const h = hex.replace('#', '');
  const n = (i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3);
  return { alpha: '1.000', red: n(0), green: n(2), blue: n(4) };
}

function colorEntry(hex, dark) {
  const entry = { color: { 'color-space': 'srgb', components: hexToComponents(hex) }, idiom: 'universal' };
  if (dark) entry.appearances = [{ appearance: 'luminosity', value: 'dark' }];
  return entry;
}

const withAccentColor = (config, props = {}) => {
  const color = props.color || '#BA5838';
  const darkColor = props.darkColor;

  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
      const dir = path.join(modConfig.modRequest.platformProjectRoot, projectName, 'Images.xcassets', 'AccentColor.colorset');
      fs.mkdirSync(dir, { recursive: true });
      const colors = [colorEntry(color, false)];
      if (darkColor) colors.push(colorEntry(darkColor, true));
      fs.writeFileSync(
        path.join(dir, 'Contents.json'),
        JSON.stringify({ colors, info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
      );
      return modConfig;
    },
  ]);

  config = withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const configs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const bc = configs[key];
      if (typeof bc !== 'object' || !bc.buildSettings) continue;
      // Only the app target's configs carry a product bundle identifier.
      if (!bc.buildSettings.PRODUCT_BUNDLE_IDENTIFIER) continue;
      bc.buildSettings.ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = 'AccentColor';
    }
    return modConfig;
  });

  return config;
};

module.exports = withAccentColor;
