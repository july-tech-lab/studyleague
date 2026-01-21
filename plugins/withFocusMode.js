const { withAndroidManifest, withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to add focus mode permissions and entitlements
 * - Android: Adds ACCESS_NOTIFICATION_POLICY permission
 * - iOS: Adds com.apple.developer.family-controls entitlement
 */
const withFocusMode = (config) => {
  // Android: Add ACCESS_NOTIFICATION_POLICY permission
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    if (!androidManifest.manifest) {
      androidManifest.manifest = {};
    }
    
    if (!androidManifest.manifest.usesPermission) {
      androidManifest.manifest.usesPermission = [];
    }
    
    // Check if permission already exists
    const hasPermission = androidManifest.manifest.usesPermission.some(
      (permission) => permission.$['android:name'] === 'android.permission.ACCESS_NOTIFICATION_POLICY'
    );
    
    if (!hasPermission) {
      androidManifest.manifest.usesPermission.push({
        $: {
          'android:name': 'android.permission.ACCESS_NOTIFICATION_POLICY',
        },
      });
    }
    
    return config;
  });

  // iOS: Add com.apple.developer.family-controls entitlement
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    
    if (!entitlements) {
      config.modResults = {};
    }
    
    // Add the family-controls entitlement
    config.modResults['com.apple.developer.family-controls'] = true;
    
    return config;
  });

  return config;
};

module.exports = withFocusMode;
