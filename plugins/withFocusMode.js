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
    
    // Use 'uses-permission' (kebab-case) to match XML element name
    const permissions = androidManifest.manifest['uses-permission'] || [];
    
    // Check if permission already exists
    const hasPermission = permissions.some(
      (permission) => permission.$['android:name'] === 'android.permission.ACCESS_NOTIFICATION_POLICY'
    );
    
    if (!hasPermission) {
      androidManifest.manifest['uses-permission'] = [
        ...permissions,
        {
          $: {
            'android:name': 'android.permission.ACCESS_NOTIFICATION_POLICY',
          },
        },
      ];
    }
    
    return config;
  });

  // iOS: Add com.apple.developer.family-controls entitlement and App Groups
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    
    if (!entitlements) {
      config.modResults = {};
    }
    
    // Add the family-controls entitlement
    config.modResults['com.apple.developer.family-controls'] = true;
    
    // Add App Groups entitlement for persisting FamilyActivitySelection
    // Note: You'll need to manually add the App Group capability in Xcode
    // The group identifier should be: group.com.juliemaitre.studyleague
    const bundleIdentifier = config.ios?.bundleIdentifier || config.android?.package || 'com.juliemaitre.studyleague';
    const appGroupIdentifier = `group.${bundleIdentifier}`;
    
    if (!config.modResults['com.apple.security.application-groups']) {
      config.modResults['com.apple.security.application-groups'] = [];
    }
    
    // Add App Group if not already present
    const appGroups = config.modResults['com.apple.security.application-groups'];
    if (Array.isArray(appGroups) && !appGroups.includes(appGroupIdentifier)) {
      appGroups.push(appGroupIdentifier);
    } else if (!Array.isArray(appGroups)) {
      config.modResults['com.apple.security.application-groups'] = [appGroupIdentifier];
    }
    
    return config;
  });

  return config;
};

module.exports = withFocusMode;
