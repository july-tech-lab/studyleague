# Focus Mode Implementation - Developer Background

## Overview

The Focus Mode feature allows the Study League app to help users minimize distractions during study sessions by controlling device notifications and app access. The implementation uses platform-specific APIs:

- **Android**: Direct Do Not Disturb (DND) control via NotificationManager
- **iOS**: Screen Time API with Family Controls framework for app blocking

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
- **App Groups**: Persists selections using `group.com.juliemaitre.studyleague`

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
   - Adds App Groups entitlement with identifier `group.com.juliemaitre.studyleague`

**Usage in app.json**:
```json
{
  "plugins": [
    "./plugins/withFocusMode"
  ]
}
```

### Module Configuration

**Location**: `modules/focus-module/expo-module.config.json`

```json
{
  "platforms": ["android", "ios"],
  "android": {
    "package": "expo.modules.focusmodule",
    "modules": ["expo.modules.focusmodule.FocusModule"]
  },
  "ios": {
    "modules": ["FocusModule"]
  }
}
```

## JavaScript Interface

**Location**: `modules/focus-module/index.ts`

```typescript
import FocusModule from './modules/focus-module';

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
2. Open `ios/studyleague.xcworkspace` in Xcode
3. **Manual Steps Required**:
   - Go to **Signing & Capabilities**
   - Add **Family Controls** capability (if not auto-added)
   - Add **App Groups** capability
   - Create/select App Group: `group.com.juliemaitre.studyleague`
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
- Selections are saved to App Group UserDefaults: `group.com.juliemaitre.studyleague`
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
- Verify the group identifier matches: `group.com.juliemaitre.studyleague`
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

## References

- [Expo Modules API](https://docs.expo.dev/modules/overview/)
- [Android NotificationManager](https://developer.android.com/reference/android/app/NotificationManager)
- [iOS Family Controls](https://developer.apple.com/documentation/familycontrols)
- [iOS ManagedSettings](https://developer.apple.com/documentation/managedsettings)
