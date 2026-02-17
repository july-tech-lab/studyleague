# Family Controls Capability Setup Guide

## Problem

Your iOS build is failing with the error:
```
Provisioning profile doesn't support the Family Controls (Development) capability.
Provisioning profile doesn't include the com.apple.developer.family-controls entitlement.
```

**If you've already enabled Family Controls in the Developer Portal** (which you have), the issue is that your **provisioning profiles need to be regenerated** to include the newly enabled capability. EAS Build may be using cached or old provisioning profiles that were created before the capability was enabled.

## Solution

### Step 1: Enable Family Controls in Apple Developer Portal

1. **Go to Apple Developer Portal**
   - Visit: https://developer.apple.com/account
   - Sign in with your Apple Developer account

2. **Navigate to Certificates, Identifiers & Profiles**
   - Click on "Certificates, Identifiers & Profiles" in the left sidebar

3. **Select Your App ID**
   - Click on "Identifiers" in the left sidebar
   - Find and select your App ID: `com.juliemaitre.studyleague`
   - If it doesn't exist, create a new App ID with this bundle identifier

4. **Enable Family Controls Capability**
   - Scroll down to the "Capabilities" section
   - Check the box for **"Family Controls"**
   - Click "Save" or "Continue"

5. **Enable App Groups (if not already enabled)**
   - While editing your App ID, also ensure **"App Groups"** is enabled
   - The App Group identifier should be: `group.com.juliemaitre.studyleague`
   - If it doesn't exist, create it:
     - Go to "App Groups" in the left sidebar
     - Click the "+" button to create a new App Group
     - Identifier: `group.com.juliemaitre.studyleague`
     - Description: "Study League App Group"
     - Click "Continue" and "Register"

6. **Regenerate Provisioning Profiles (CRITICAL STEP)**
   
   Since the capability is already enabled, the issue is that your provisioning profiles are outdated. You have two options:
   
   **Option A: Let EAS Build regenerate automatically (Recommended)**
   - EAS Build will automatically regenerate provisioning profiles on the next build
   - However, you may need to clear the cache and wait for propagation
   - Use: `eas build --platform ios --profile production --clear-cache`
   
   **Option B: Manually regenerate in Developer Portal**
   - Go to "Profiles" in the left sidebar
   - Find ALL provisioning profiles for `com.juliemaitre.studyleague`:
     - Development profiles
     - App Store profiles (this is the one causing the error)
     - Ad Hoc profiles (if any)
   - For each profile:
     - Click on it to view details
     - Click "Edit"
     - Click "Generate" to create a new profile with updated capabilities
     - Wait for it to be generated (usually instant)
   - **Important**: Delete old profiles after generating new ones to avoid confusion

### Step 2: Verify Configuration

1. **Check app.config.js**
   - Ensure the bundle identifier is correct: `com.juliemaitre.studyleague`
   - Verify the `withFocusMode` plugin is in the plugins array

2. **Check withFocusMode.js plugin**
   - The plugin should add:
     - `com.apple.developer.family-controls` entitlement
     - `com.apple.security.application-groups` entitlement with `group.com.juliemaitre.studyleague`

3. **Verify App Group identifier matches**
   - In `plugins/withFocusMode.js`: `group.com.juliemaitre.studyleague`
   - In `modules/focus-module/ios/FocusModule.swift`: `group.com.juliemaitre.studyleague`
   - In Apple Developer Portal: `group.com.juliemaitre.studyleague`

### Step 3: Force EAS Build to Regenerate Profiles

Since the capability is already enabled, force EAS Build to fetch fresh provisioning profiles:

```bash
# For production/AppStore builds (this is what's failing)
eas build --platform ios --profile production --clear-cache

# If that doesn't work, try revoking and regenerating credentials
eas credentials
# Then select iOS → Production → Remove credentials → Build again
```

**Alternative: Use EAS Credentials Manager**

If clearing cache doesn't work, you can force EAS to regenerate credentials:

```bash
# List current credentials
eas credentials

# For iOS production credentials
eas credentials -p ios

# Select your app, then choose to regenerate provisioning profiles
# This will force EAS to create new profiles with the Family Controls capability
```

Then rebuild:
```bash
eas build --platform ios --profile production
```

## Important Notes

1. **Restricted Capability**: Family Controls is a restricted capability that requires:
   - Explicit enablement in Apple Developer Portal
   - Approval from Apple (usually automatic for most apps)
   - Proper provisioning profiles that include the capability

2. **App Groups**: The App Groups capability is also required for persisting Family Activity selections. Make sure both are enabled.

3. **Provisioning Profile Regeneration**: After enabling capabilities, provisioning profiles must be regenerated. EAS Build will do this automatically, but it may take a few minutes.

4. **Development vs Production**: Even though the capability shows as "Family Controls (Development)" in the UI, it applies to both Development and Production/AppStore builds. The issue is that your AppStore provisioning profile was created before the capability was enabled, so it needs to be regenerated.

5. **Time to Propagate**: After enabling the capability in the Developer Portal, it may take 5-15 minutes for the changes to propagate. Wait a few minutes before rebuilding.

## Troubleshooting

### If the capability doesn't appear in the list:
- Make sure you're using a paid Apple Developer account (not a free account)
- Family Controls requires iOS 15.0+ and is only available for certain app types
- Contact Apple Developer Support if the capability is not available

### If builds still fail after enabling the capability:
1. **Force credential regeneration** (most common fix):
   ```bash
   eas credentials -p ios
   # Select your app → Production → Remove/Regenerate credentials
   eas build --platform ios --profile production --clear-cache
   ```

2. **Wait for propagation**: After enabling capabilities or regenerating profiles, wait 10-15 minutes for changes to propagate through Apple's systems

3. **Verify capability is enabled**: Double-check in Developer Portal that Family Controls is checked for your App ID

4. **Check App Group**: Verify the App Group identifier matches exactly (case-sensitive): `group.com.juliemaitre.studyleague`

5. **Check for multiple App IDs**: Make sure you're enabling the capability on the correct App ID that matches your bundle identifier

6. **Contact EAS Support**: If the issue persists, the EAS Build service might need to refresh its credential cache. Contact Expo support or check EAS Build logs for more details.

### If you see "Capability not available":
- This might mean your Apple Developer account doesn't have access to Family Controls
- Some capabilities require special approval or are limited to certain account types
- Check Apple's documentation for Family Controls requirements

## References

- [Apple Family Controls Documentation](https://developer.apple.com/documentation/familycontrols)
- [EAS Build iOS Configuration](https://docs.expo.dev/build/eas-json/#ios)
- [Apple Developer Portal](https://developer.apple.com/account)
