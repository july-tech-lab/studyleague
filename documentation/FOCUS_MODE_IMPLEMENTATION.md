# Focus mode (Tymii) — implementation and iOS provisioning

This document covers the **native focus module**, **strict-focus product behavior**, and **Apple Family Controls / EAS provisioning** (App ID, entitlements, profile regeneration).

## Contents

- [Overview](#overview)
- Implementation: [Architecture](#architecture) through [Troubleshooting](#troubleshooting)
- [Family Controls and iOS provisioning](#family-controls-and-ios-provisioning)
- [References](#references)

## Overview

The Focus Mode feature allows the Study League app to help users minimize distractions during study sessions by controlling device notifications and app access. The implementation uses platform-specific APIs:

- **Android**: Direct Do Not Disturb (DND) control via NotificationManager
- **iOS**: Screen Time API with Family Controls framework for app blocking

## Strict focus (Tymii — current product behavior)

Tymii runs the study timer in **strict focus** on **iOS** and **Android**: starting a session turns on native restrictions; stopping turns them off, then the session is saved. **Web** keeps a non-blocking timer (`isStrictFocusEnabled()` is false).

| Piece | Role |
|--------|------|
| [`constants/strictFocus.ts`](./constants/strictFocus.ts) | `isStrictFocusEnabled()` → `true` for `ios` / `android`, `false` for `web`. |
| [`modules/focus-module/index.ts`](./modules/focus-module/index.ts) | Loads real **`FocusModule`** when strict focus is on and platform ≠ web; otherwise **no-op** stubs so web/Metro do not crash. |
| [`hooks/useTimer.ts`](./hooks/useTimer.ts) | `requireFocusMode` defaults to `isStrictFocusEnabled()`. On **`start`**: `FocusModule.setFocusMode(true)` after checks. On **`stop`**: `setFocusMode(false)` then persist session. |
| [`hooks/useStudyMode.ts`](./hooks/useStudyMode.ts) | Same gate as native module; permission, **`presentAppPicker`**, **`checkSelectedApps`**, loading state. |
| [`app/(tabs)/index.tsx`](./app/(tabs)/index.tsx) | Before start: permission flow + **iOS** picker if nothing selected; **Start** disabled until `useTimer`’s **`canStart`**; UI copy when focus is active. |

**Autolinking / prebuild**

- Root [`package.json`](./package.json) includes `"focus-module": "file:./modules/focus-module"` so Expo autolinks the local module.

**Expo config**

- [`app.json`](./app.json) → `plugins` includes `"./plugins/withFocusMode.js"`.
- [`plugins/withFocusMode.js`](./plugins/withFocusMode.js) adds Android `ACCESS_NOTIFICATION_POLICY` and, when enabled, iOS **Family Controls** + **App Group** entitlements. To ship **without** iOS Family Controls (e.g. review constraints), you must adjust this plugin or use a build-specific variant—strict focus on iOS depends on Apple approving the capability.

**Android bridge specifics**

- **`presentFamilyActivityPicker`**: no-op on Android (JS may still `await` it).
- **`getSelectedApps()`**: returns whether **notification policy access** is granted so the “ready to start” logic mirrors iOS “selection exists” as closely as possible. Blocking is **not** per-app on Android (DND priority only); see **Platform Differences** below.

**iOS**

- Physical device recommended; Simulator Screen Time behavior is unreliable. Portal and EAS provisioning: **[Family Controls and iOS provisioning](#family-controls-and-ios-provisioning)** (below).

## Architecture

### Module Structure

```
modules/focus-module/
├── android/
│   └── src/main/java/expo/modules/focusmodule/
│       └── FocusModule.kt          # Android native module
├── ios/
│   └── FocusModule.swift           # iOS native module
├── index.ts                        # JavaScript/TypeScript interface
├── package.json                    # Module package definition
└── expo-module.config.json         # Expo module configuration
```

### Config Plugin

```
plugins/
└── withFocusMode.js                # Expo config plugin for permissions/entitlements
```

## Platform-Specific Implementation

### Android Implementation

**Location**: `modules/focus-module/android/src/main/java/expo/modules/focusmodule/FocusModule.kt`

**Features**:
- Direct control over Do Not Disturb mode
- Uses `NotificationManager.setInterruptionFilter()`
- Requires `ACCESS_NOTIFICATION_POLICY` permission

**Functions**:
1. `checkPermission()`: Checks if notification policy access is granted
2. `requestPermission()`: Opens system settings for DND access
3. `setFocusMode(enabled: Boolean)`: 
   - `true`: Sets `INTERRUPTION_FILTER_PRIORITY` (priority-only notifications)
   - `false`: Sets `INTERRUPTION_FILTER_ALL` (all notifications)
4. `presentFamilyActivityPicker()`: **No-op** on Android (keeps JS API consistent with iOS)
5. `getSelectedApps()`: Returns **true** when notification policy is granted (strict-focus “ready” signal, not a list of packages)

**Permissions**:
- `android.permission.ACCESS_NOTIFICATION_POLICY` (added via config plugin)

### iOS Implementation

**Location**: `modules/focus-module/ios/FocusModule.swift`

**Features**:
- Uses Screen Time API (Family Controls framework)
- App blocking via "Shields" (opaque tokens)
- Requires user to select apps via system picker
- Persists selections across app restarts using App Groups

**Functions**:
1. `checkPermission()`: Checks Screen Time authorization status
2. `requestPermission()`: Requests Family Controls authorization
3. `presentFamilyActivityPicker()`: Shows system app picker for user selection
4. `setFocusMode(enabled: Boolean)`:
   - `true`: Applies shields to selected apps/categories/websites
   - `false`: Removes all shields
5. `getSelectedApps()`: Returns whether apps are currently selected

**Key Components**:
- **ManagedSettingsStore**: Applies shields to block apps
- **FamilyActivityPicker**: System UI for selecting apps to block
- **FamilyActivitySelection**: Opaque token collection (cannot be serialized to JS)
- **App Groups**: Persists selections using `group.com.juliemaitre.tymii`

**Entitlements**:
- `com.apple.developer.family-controls` (added via config plugin)
- `com.apple.security.application-groups` (added via config plugin)

## Configuration

### Expo Config Plugin

**Location**: `plugins/withFocusMode.js`

**What it does**:
1. **Android**: Adds `ACCESS_NOTIFICATION_POLICY` permission to AndroidManifest.xml
2. **iOS**: 
   - Adds `com.apple.developer.family-controls` entitlement
   - Adds App Groups entitlement with identifier `group.com.juliemaitre.tymii`

**Usage in app.json** (Tymii root project):
```json
{
  "plugins": [
    "./plugins/withFocusMode.js"
  ]
}
```
Other plugins (`expo-router`, etc.) remain in the same array as in [`app.json`](./app.json).

### Module Configuration

**Location**: `modules/focus-module/expo-module.config.json`

```json
{
  "platforms": ["ios", "android"],
  "ios": {
    "modules": ["FocusModule"]
  },
  "android": {
    "package": "expo.modules.focusmodule",
    "modules": ["expo.modules.focusmodule.FocusModule"]
  }
}
```
(Exact copy: [`modules/focus-module/expo-module.config.json`](./modules/focus-module/expo-module.config.json).)

## JavaScript Interface

**Location**: `modules/focus-module/index.ts`

The project imports the module as `@/modules/focus-module` (path alias) or `focus-module` after the `file:` dependency; behavior is strict vs no-op depending on [`isStrictFocusEnabled()`](./constants/strictFocus.ts) and platform.

```typescript
import FocusModule from '@/modules/focus-module';
// or: import FocusModule from 'focus-module';

// Check if permission is granted
const hasPermission = await FocusModule.checkPermission();

// Request permission (opens system settings)
await FocusModule.requestPermission();

// Present app picker (iOS only)
await FocusModule.presentFamilyActivityPicker();

// Enable/disable focus mode
await FocusModule.setFocusMode(true);  // Enable
await FocusModule.setFocusMode(false); // Disable

// Check if apps are selected (iOS only)
const hasSelection = FocusModule.getSelectedApps();
```

## Usage Example

```typescript
import FocusModule from './modules/focus-module';

const toggleStudyMode = async (isStarting: boolean) => {
  try {
    // Check permission
    const hasAccess = await FocusModule.checkPermission();
    
    if (!hasAccess) {
      alert("Please allow notification access for focus mode!");
      await FocusModule.requestPermission();
      return;
    }
    
    // On iOS, ensure apps are selected
    if (Platform.OS === 'ios') {
      const hasSelection = FocusModule.getSelectedApps();
      if (!hasSelection && isStarting) {
        // Show picker to select apps
        await FocusModule.presentFamilyActivityPicker();
      }
    }
    
    // Enable/disable focus mode
    await FocusModule.setFocusMode(isStarting);
    
    console.log(isStarting ? "Focus mode enabled!" : "Focus mode disabled.");
  } catch (error) {
    console.error("Focus mode error:", error);
  }
};
```

## Versioning & Dependencies

### Minimum SDK Requirements

**Android**:
- **API Level**: 23 (Android 6.0 Marshmallow) or higher
- **Reason**: `NotificationManager.setInterruptionFilter()` was introduced in API 23
- **Permission**: `ACCESS_NOTIFICATION_POLICY` requires API 23+

**iOS**:
- **iOS Version**: 15.0 or higher
- **Reason**: `FamilyControls` and `ManagedSettings` frameworks require iOS 15.0+
- **Frameworks**: 
  - `FamilyControls.framework` (iOS 15.0+)
  - `ManagedSettings.framework` (iOS 15.0+)

### Expo SDK
- Compatible with Expo SDK 54+
- Uses `expo-modules-core` for native module bridge

## Platform Differences

| Feature | Android | iOS |
|---------|---------|-----|
| **Control Method** | Direct DND control | Screen Time Shields |
| **User Selection** | Not required | Required (via picker) |
| **Data Persistence** | Not needed | App Groups UserDefaults |
| **Notification Behavior** | Silences, still in tray | Completely blocks |
| **App Blocking** | No | Yes (via shields) |
| **Data Types** | Package names (strings) | Opaque tokens (non-serializable) |
| **Minimum Version** | Android 6.0 (API 23) | iOS 15.0 |

## Setup Requirements

### Android
1. Run `npx expo prebuild` to generate native code
2. Permission is automatically added via config plugin
3. User must grant DND access in system settings (first time only)

### iOS
1. Run `npx expo prebuild` to generate native code
2. Open `ios/tymii.xcworkspace` in Xcode
3. **Manual Steps Required**:
   - Go to **Signing & Capabilities**
   - Add **Family Controls** capability (if not auto-added)
   - Add **App Groups** capability
   - Create/select App Group: `group.com.juliemaitre.tymii`
   - Select your Developer Team
4. Build and run: `npx expo run:ios`

## Important Notes

### iOS Limitations
1. **Opaque Tokens**: `FamilyActivitySelection` cannot be serialized to JavaScript. The selection is stored natively and managed in Swift.
2. **User Selection Required**: Users must select apps via the system picker - you cannot hardcode app IDs.
3. **Persistence**: Selections are persisted using App Groups UserDefaults, but tokens may not survive app updates.
4. **Testing**: Screen Time APIs are unreliable in iOS Simulator - **test on physical device**.
5. **Hardware-Specific Tokens**: Screen Time tokens are unique to physical hardware. Simulators will often report "Permission Granted" but fail to actually block apps.

### Android Limitations
1. **One-time Permission**: User must grant DND access in system settings (cannot be granted programmatically).
2. **Notification Behavior**: Notifications are silenced but still appear in the notification tray.

### Data Persistence (iOS)
- Selections are saved to App Group UserDefaults: `group.com.juliemaitre.tymii`
- Uses JSON encoding (iOS 15+) with NSKeyedArchiver fallback
- Loaded automatically on module initialization
- If unarchiving fails, user will need to reselect apps

## Native Safety & Edge Cases

### OS-Level Overrides

**Critical**: The system always has priority over app-level controls.

- **Android**: If a user manually turns off Do Not Disturb via Quick Settings or Control Panel, calling `setFocusMode(false)` will succeed but won't change the hardware state if DND is already off.
- **iOS**: If a user manually disables Screen Time restrictions in Settings, the shields will be removed regardless of your app's state.

**Recommendation**: Always check the current state before assuming focus mode is active. Consider implementing periodic state verification.

### App Lifecycle & State Recovery

#### App Termination Behavior

**Android**:
- If the app is force-closed during a study session, **Do Not Disturb will persist** because it's managed by the system kernel, not the app process.
- The interruption filter remains active until:
  - The user manually disables DND in system settings
  - Another app with DND permission changes it
  - The device is restarted (depending on system settings)

**iOS**:
- If the app is force-closed during a study session, **App Shields will persist** because they're enforced by the iOS kernel via ManagedSettings.
- The shields remain active until:
  - The user manually disables Screen Time restrictions
  - Your app calls `setFocusMode(false)` on next launch
  - The app is uninstalled

**State Recovery Strategy**:
1. On app launch, check if focus mode should be active based on your app's state (e.g., active study session in database)
2. If focus mode should be active but isn't, re-enable it
3. If focus mode is active but shouldn't be (e.g., study session ended), disable it
4. Store focus mode state in your app's persistent storage (not just native state)

```typescript
// Example: State recovery on app launch
useEffect(() => {
  const restoreFocusMode = async () => {
    const activeSession = await getActiveStudySession();
    const isFocusActive = await checkFocusModeState(); // Your custom check
    
    if (activeSession && !isFocusActive) {
      await FocusModule.setFocusMode(true);
    } else if (!activeSession && isFocusActive) {
      await FocusModule.setFocusMode(false);
    }
  };
  
  restoreFocusMode();
}, []);
```

### Permission Revocation

Users can manually revoke permissions at any time without alerting your app:

**Android**:
- User can revoke `ACCESS_NOTIFICATION_POLICY` in Settings → Apps → Your App → Permissions
- Your app won't be notified - `checkPermission()` will return `false` on next check

**iOS**:
- User can revoke Screen Time authorization in Settings → Screen Time → App Limits
- Your app won't be notified - `checkPermission()` will return `false` on next check

**Recommendation**: 
- Periodically check permission status (e.g., before enabling focus mode)
- Show user-friendly messages if permission is revoked
- Provide easy path to re-grant permission

### Bridge Timeouts & User Attention

**Critical UX Consideration**: Several operations move the user's attention outside your app:

1. **`requestPermission()` (Both Platforms)**:
   - Opens system settings
   - User may not return to your app
   - Your JavaScript promise may not resolve if user doesn't return

2. **`presentFamilyActivityPicker()` (iOS)**:
   - Shows full-screen system picker
   - User may dismiss without selecting
   - User may navigate away from picker

**Handling Strategy**:
```typescript
// Set reasonable timeout for permission requests
const requestPermissionWithTimeout = async () => {
  try {
    await Promise.race([
      FocusModule.requestPermission(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 30000)
      )
    ]);
  } catch (error) {
    // Handle timeout or user cancellation
    console.log('Permission request timed out or was cancelled');
  }
};
```

### Auto-Turn-Off Safety Mechanism

**Current Implementation**: The module does not automatically disable focus mode if the app crashes.

**Risk**: If the app crashes while focus mode is active, users might be stuck without notifications until they:
- Manually disable DND (Android) or Screen Time restrictions (iOS)
- Reopen your app and disable focus mode
- Restart their device

**Recommended Safety Implementation**:
1. **Session Timeout**: Automatically disable focus mode after a maximum duration (e.g., 4 hours)
2. **Background Task**: Use background tasks to periodically verify focus mode should still be active
3. **App State Monitoring**: Monitor app lifecycle and disable focus mode if app is terminated unexpectedly
4. **User Notification**: Show a notification when focus mode is enabled, allowing quick disable

```typescript
// Example: Safety timeout
const enableFocusModeWithTimeout = async (durationMinutes: number = 240) => {
  await FocusModule.setFocusMode(true);
  
  // Auto-disable after duration
  setTimeout(async () => {
    const hasActiveSession = await checkActiveStudySession();
    if (!hasActiveSession) {
      await FocusModule.setFocusMode(false);
      showNotification("Focus mode automatically disabled after 4 hours");
    }
  }, durationMinutes * 60 * 1000);
};
```

## Technical Details

### iOS Shield Application
When `setFocusMode(true)` is called:
```swift
settingsStore.shield.applications = selection.applicationTokens
settingsStore.shield.applicationCategories = .specific(selection.categoryTokens)
settingsStore.shield.webDomains = selection.webDomainTokens
```

This applies "shields" to:
- Specific applications (via application tokens)
- App categories (via category tokens)
- Web domains (via web domain tokens)

### Android Interruption Filters
- `INTERRUPTION_FILTER_PRIORITY`: Only priority notifications allowed
- `INTERRUPTION_FILTER_ALL`: All notifications allowed

## Future Enhancements

1. **Custom Picker UI**: Add Done/Cancel buttons to iOS picker for better UX
2. **Selection Management**: Allow users to view/edit selected apps
3. **Scheduled Focus**: Automatically enable/disable based on study schedule
4. **Cross-platform API**: Unify the API surface between platforms where possible

## Troubleshooting

### Common Failures & Debugging

#### Bridge Timeouts
**Symptom**: `requestPermission()` or `presentFamilyActivityPicker()` never resolves.

**Causes**:
- User navigated away from system settings/picker
- System UI was dismissed without completing action
- App was backgrounded during permission flow

**Solution**:
- Implement timeout handling (see "Bridge Timeouts & User Attention" above)
- Check permission status after timeout instead of waiting for promise
- Provide fallback UI if permission flow is interrupted

#### Permission Revocation
**Symptom**: `checkPermission()` returns `false` unexpectedly, or focus mode stops working.

**Causes**:
- User manually revoked permission in system settings
- System reset permissions after OS update
- Permission was revoked by device administrator (enterprise devices)

**Solution**:
- Always check permission before enabling focus mode
- Show user-friendly error if permission is missing
- Provide clear instructions to re-grant permission
- Consider showing permission status in app settings

#### State Recovery Issues
**Symptom**: Focus mode is active but app doesn't know about it, or vice versa.

**Causes**:
- App was killed while focus mode was active
- App state wasn't properly synced with native state
- Database/state storage was cleared

**Solution**:
- Implement state recovery on app launch (see "App Lifecycle & State Recovery" above)
- Store focus mode state in persistent storage
- Verify state consistency between app and native module

### iOS: "Could not access App Group UserDefaults"
- Ensure App Groups capability is added in Xcode
- Verify the group identifier matches: `group.com.juliemaitre.tymii`
- Check that your Developer Team is selected
- Verify the App Group is enabled in both Debug and Release configurations

### iOS: "Screen Time permission not granted"
- User must grant permission via `requestPermission()`
- Permission dialog appears only once per app install
- Check if permission was revoked in Settings → Screen Time
- Verify Family Controls entitlement is present in Xcode

### iOS: "No apps selected" error
- User must select apps via `presentFamilyActivityPicker()` before enabling focus mode
- Check `getSelectedApps()` before calling `setFocusMode(true)`
- If selection was lost, prompt user to reselect apps

### Android: Permission not working
- User must manually grant DND access in system settings
- Check AndroidManifest.xml for `ACCESS_NOTIFICATION_POLICY` permission
- Verify permission is granted in Settings → Apps → Your App → Permissions
- Some Android skins (MIUI, ColorOS) may have additional permission layers

### Android: DND not applying
- Verify `ACCESS_NOTIFICATION_POLICY` permission is granted
- Check if another app is controlling DND
- Some devices require additional battery optimization exemptions
- Test on different Android versions (API 23+)

### Module not found
- Run `npx expo prebuild --clean` to regenerate native code
- Ensure module is in `modules/focus-module/` directory
- Check `expo-module.config.json` is correct
- Verify module is listed in `app.json` plugins array
- Clear Metro bundler cache: `npx expo start --clear`

### iOS: Simulator issues
- Screen Time APIs are unreliable in iOS Simulator
- Tokens are hardware-specific and won't work in simulator
- **Always test on physical device** for Screen Time features
- Simulator may show "Permission Granted" but fail to block apps

### State Persistence Issues (iOS)
- Verify App Group is properly configured in Xcode
- Check that UserDefaults suite name matches App Group identifier
- Selections may be lost after app updates - implement reselection flow
- Test persistence by force-closing app and reopening

## Family Controls and iOS provisioning

Enable **Family Controls** and **App Groups** on the App ID, keep the repo plugin aligned, and refresh provisioning profiles when builds fail on entitlements.

### Symptom and root cause

iOS builds often fail with:

```
Provisioning profile doesn't support the Family Controls (Development) capability.
Provisioning profile doesn't include the com.apple.developer.family-controls entitlement.
```

**Typical cause:** the provisioning profile was created **before** the capability was enabled on the App ID, or EAS is reusing a cached profile. The profile must be **regenerated** after the App ID includes Family Controls (and App Groups, if you use them).

If the capability is already enabled in the Developer portal, the issue is almost always **stale profiles** plus, when needed, the **EAS credentials manager** (see below).

### Apple Developer portal — App ID and capabilities

1. Open [Apple Developer Account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → select the App ID `com.juliemaitre.tymii` (or create it with this bundle ID).
3. Under **Capabilities**:
   - Enable **Family Controls**, save.
   - Enable **App Groups**; the group must be **`group.com.juliemaitre.tymii`**.
4. If the group does not exist: sidebar **App Groups** → **+** → identifier `group.com.juliemaitre.tymii`, description e.g. “Study League App Group”, register, then attach that group to the App ID.

**Notes**

- If the UI shows “Family Controls (Development)” / “Development only”, that is often fine; what matters is that the **App ID** has the capability and the **profile** is regenerated afterward.
- After App ID changes, wait **5–15 minutes** (Apple propagation) before an important rebuild.

### Verify the repository configuration

1. **Bundle ID:** `com.juliemaitre.tymii` (your app config / `app.json` as applicable).
2. **Plugin:** `./plugins/withFocusMode.js` must be listed in the Expo plugins array.
3. **Expected entitlements** (from the plugin):
   - `com.apple.developer.family-controls`
   - `com.apple.security.application-groups` with `group.com.juliemaitre.tymii`
4. **Group consistency:** same identifier in `plugins/withFocusMode.js`, `modules/focus-module/ios/FocusModule.swift`, and the Apple portal.

### Regenerate provisioning profiles

#### First try: build with cleared cache

Often refreshes profiles on the EAS side. Use the **EAS build profile** that is failing (`development`, `production`, etc.):

```bash
# Example: production / App Store
eas build --platform ios --profile production --clear-cache

# Example: development (Ad Hoc / dev client)
eas build --profile development --platform ios --clear-cache
```

If logs show **“Synced capabilities: No updates”** but the entitlement error remains, use the credentials manager (next subsection).

#### EAS credentials manager — force new profiles

```bash
eas credentials -p ios
```

In the interactive menu (wording may vary slightly by CLI version):

1. Choose **build credentials** management for iOS.
2. Select the project if prompted (e.g. `@juliemaitre/tymii`).
3. Pick the **build profile** you care about: **`development`**, **`production`**, or regenerate **all** if you want a full reset.
4. Useful options:
   - **“All: Set up all the required credentials…”** (recommended for a clean redo), or
   - **“Provisioning Profile: Delete one from your project”** if “All” is not enough.
5. If EAS asks to reuse a profile: choose **not** to reuse (e.g. **“No, let me choose devices again”**) to **force** a new profile that reflects the current App ID capabilities.
6. After deleting an obsolete Ad Hoc profile, the next build recreates one; confirm it includes Family Controls.

**Important:** even when EAS shows “Synced capabilities: No updates”, refusing to reuse the profile may be required to get a profile that actually matches the App ID.

#### Manual regeneration in the Developer portal (optional)

- **Profiles** → for each profile tied to `com.juliemaitre.tymii` (Development, App Store, Ad Hoc): **Edit** → **Generate** so it picks up current capabilities.
- Remove old profiles once new ones are validated to avoid confusion.

### Why provisioning errors happen (short list)

1. **Capability added after** the profile was created → old profile lacks the entitlement.
2. **EAS cache** → `--clear-cache` helps; sometimes you must delete/regenerate via `eas credentials`.
3. **Capability sync** → “No updates” does not guarantee the profile on Apple’s side was recreated at the right time.
4. **Same profile ID** → EAS may “update” an existing profile instead of creating a new one; if that profile predates Family Controls, delete it in the **Developer portal** to force a fresh one (see advanced troubleshooting below).

### Verification after the fix

Build logs should show the profile includes **Family Controls** (and App Groups if required), with no errors about `com.apple.developer.family-controls`.

### Advanced provisioning troubleshooting

#### New profile but capabilities still missing

Often an **App Groups** mismatch on the App ID:

1. **Identifiers** → App ID `com.juliemaitre.tymii` → confirm Family Controls, App Groups, and explicit listing of `group.com.juliemaitre.tymii`.
2. If App Groups is on but the group is not listed: create the group identifier (sidebar **App Groups**), then select it on the App ID.
3. Wait **10–15 minutes**, delete the bad profile under **Profiles** if needed, then:

   ```bash
   eas build --profile development --platform ios --clear-cache
   ```

   Adjust `--profile` to the EAS profile you use.

#### EAS and Ad Hoc profiles — manual last resort

If EAS will not produce an Ad Hoc profile with the right capabilities:

1. In the portal: **Profiles** → delete the existing Expo Ad Hoc profile for this app (name pattern like `*[expo] com.juliemaitre.tymii AdHoc …`).
2. **+** → **Ad Hoc** → App ID `com.juliemaitre.tymii` → distribution certificate → devices → generate.
3. Open the new profile and confirm **Family Controls** and **App Groups** with `group.com.juliemaitre.tymii`.
4. `eas credentials -p ios` → attach it if needed (**Provisioning Profile** → use existing profile).
5. Rebuild with `--clear-cache`.

#### Same provisioning profile ID in the error (EAS “updates” the old one)

If the error still references the **same** profile ID, EAS may be reusing a profile created before Family Controls.

1. **Developer portal** → **Profiles** → find profiles for `com.juliemaitre.tymii` (often **AdHoc** for the dev client).
2. **Delete** the bad profile (not only “regenerate” via EAS if it keeps the same ID).
3. Then:

   ```bash
   eas build --profile development --platform ios --clear-cache
   ```

   EAS should create a **new** profile from the current App ID.

#### Capability missing from the list (portal)

- You need a **paid** Apple Developer account (not a limited free account).
- Family Controls has Apple requirements (OS, app type) — see Apple’s documentation.
- If you are blocked: Apple Developer Support.

#### Still failing

- Double-check App ID, bundle ID, and that you do not have **multiple** inconsistent App IDs.
- Contact Expo / EAS support with: project slug, failing profile ID, and proof that Family Controls is enabled on the App ID.

## References

- [Expo Modules API](https://docs.expo.dev/modules/overview/)
- [EAS Build — iOS configuration](https://docs.expo.dev/build/eas-json/#ios)
- [Apple Developer portal](https://developer.apple.com/account)
- [Android NotificationManager](https://developer.android.com/reference/android/app/NotificationManager)
- [iOS Family Controls](https://developer.apple.com/documentation/familycontrols)
- [iOS ManagedSettings](https://developer.apple.com/documentation/managedsettings)
