// Temporary: strip the Push Notifications entitlement that expo-notifications adds.
// Quiett only schedules LOCAL notifications (evening reminder), which don't need it.
// Remove this plugin once the Apple Developer account is active and push is wanted.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
