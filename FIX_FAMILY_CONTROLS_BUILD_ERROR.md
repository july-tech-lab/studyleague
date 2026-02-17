# Fix: Family Controls Provisioning Profile Error

## Problem
Your iOS build is failing with:
```
Provisioning profile doesn't support the Family Controls (Development) capability.
Provisioning profile doesn't include the com.apple.developer.family-controls entitlement.
```

## Root Cause
EAS Build created an Ad Hoc provisioning profile **before** the Family Controls capability was enabled in your App ID, or the profile wasn't regenerated after enabling the capability.

## Solution: Regenerate Provisioning Profile

### Step 1: Verify Capability is Enabled in Developer Portal
1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → Find `com.juliemaitre.studyleague`
4. Verify **Family Controls** is checked ✅
   - **Note**: If it shows "Family Controls (Development) - Development only", this is normal
   - The capability applies to both Development and Ad Hoc builds
5. Verify **App Groups** is checked ✅ with `group.com.juliemaitre.studyleague`

**Important**: Even if Family Controls shows as "Development only" in the UI, it should work for Ad Hoc provisioning profiles. The issue is that your provisioning profile was created before the capability was enabled or needs to be regenerated.

### Step 2: Force EAS to Regenerate Credentials

Run this command to open the credentials manager:

```bash
eas credentials -p ios
```

**In the interactive menu:**
1. Select **"Build Credentials: Manage everything needed to build your project"** (press Enter)
2. Select your project: `@juliemaitre/studyleague` (if prompted)
3. Choose the build profile: **"development"** (or "All" to regenerate all profiles)
4. You'll see a menu with options. Choose one of:
   - **"All: Set up all the required credentials to build your project"** (RECOMMENDED - completely regenerates everything)
   - **"Provisioning Profile: Delete one from your project"** (if "All" doesn't work, try this)
5. If you chose "All", EAS will check your credentials. **IMPORTANT**: When asked "Would you like to reuse the profile?", select **"No, let me choose devices again"** to force regeneration
6. If you chose "Provisioning Profile: Delete", select the profile to delete (usually the Ad Hoc one with ID like `1769069897490`)
7. EAS will create a new provisioning profile with Family Controls capability on the next build

**Note**: Even if EAS says "Synced capabilities: No updates", selecting "No" to reuse the profile will force it to create a new one that should include the capability.

### Step 3: Rebuild with Cleared Cache

After regenerating credentials, rebuild with cache cleared:

```bash
eas build --profile development --platform ios --clear-cache
```

## Alternative: Non-Interactive Approach

If you prefer to let EAS handle it automatically:

```bash
# This will force EAS to sync capabilities and regenerate profiles
eas build --profile development --platform ios --clear-cache
```

However, if the capability sync didn't work (as shown in your logs: "Synced capabilities: No updates"), you'll need to use the credentials manager approach above.

## Why This Happens

1. **Capability Added After Profile Creation**: If you enabled Family Controls in the Developer Portal after EAS created the provisioning profile, the profile won't include it.

2. **EAS Cache**: EAS may cache old provisioning profiles. The `--clear-cache` flag helps, but sometimes manual regeneration is needed.

3. **Capability Sync Timing**: Even though EAS says "Synced capabilities: No updates", the provisioning profile may have been created before the sync detected the capability.

4. **"Development Only" Label**: Even if Family Controls shows as "Development only" in the Developer Portal, it should still work for Ad Hoc profiles. The label refers to the capability type, not the provisioning profile type. The key is that the provisioning profile must be regenerated after enabling the capability.

## Verification

After regenerating, you should see in the build logs:
- ✅ Provisioning profile includes Family Controls capability
- ✅ No errors about missing entitlements

## New Profile Created But Still Missing Capabilities

If EAS creates a new profile (different ID) but it still doesn't include Family Controls or App Groups, the issue is that the **App Group** may not be properly configured in the Developer Portal.

### Verify App Group Setup

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles** → **Identifiers**
3. Find your App ID: `com.juliemaitre.studyleague`
4. Click on it and verify:
   - ✅ **Family Controls** is checked
   - ✅ **App Groups** is checked
   - ✅ The App Group `group.com.juliemaitre.studyleague` is listed

5. **If App Groups is checked but the group isn't listed:**
   - Go to **App Groups** in the left sidebar
   - Click the "+" button to create a new App Group
   - Identifier: `group.com.juliemaitre.studyleague`
   - Description: "Study League App Group"
   - Click "Continue" and "Register"
   - Go back to your App ID and make sure the App Group is selected

6. **Wait 10-15 minutes** for changes to propagate

7. **Delete the new provisioning profile** (ID: `22FA6HF87N` or similar) from Developer Portal:
   - Go to **Profiles** → Find the profile → Delete it

8. **Rebuild:**
   ```bash
   eas build --profile development --platform ios --clear-cache
   ```

## EAS Not Including Capabilities in Ad Hoc Profiles

If EAS keeps saying "Synced capabilities: No updates" but the profile still doesn't include Family Controls, EAS may not be properly including capabilities in Ad Hoc profiles. You need to **manually create the provisioning profile** in the Developer Portal.

### Manual Provisioning Profile Creation (Last Resort)

1. **Delete the existing Ad Hoc profile** in Developer Portal:
   - Go to **Profiles** → Find `*[expo] com.juliemaitre.studyleague AdHoc 1769072476555` (or similar)
   - Delete it

2. **Manually create a new Ad Hoc profile**:
   - Go to **Profiles** → Click "+" to create new
   - Select **"Ad Hoc"** as the distribution type
   - Select your App ID: `com.juliemaitre.studyleague`
   - Select your Distribution Certificate
   - Select your device(s)
   - **Name it**: `*[expo] com.juliemaitre.studyleague AdHoc` (or let EAS manage it)
   - Click **Generate**

3. **Verify the profile includes capabilities**:
   - After generation, click on the profile
   - Check that it shows:
     - ✅ Family Controls capability
     - ✅ App Groups capability with `group.com.juliemaitre.studyleague`

4. **If the profile doesn't include the capabilities**:
   - The App ID might not have them properly enabled
   - Go back to **Identifiers** → `com.juliemaitre.studyleague`
   - Verify Family Controls and App Groups are checked
   - Make sure the App Group `group.com.juliemaitre.studyleague` exists as a separate identifier
   - Save and try creating the profile again

5. **Tell EAS to use the manual profile**:
   ```bash
   eas credentials -p ios
   ```
   - Select "Build Credentials" → "development"
   - Select "Provisioning Profile" → Choose to use existing
   - Select the manually created profile

6. **Rebuild:**
   ```bash
   eas build --profile development --platform ios --clear-cache
   ```

**Note**: If manually created profiles also don't include the capabilities, there may be an issue with how the capabilities are enabled in your App ID. Double-check the App ID configuration.

## If It Still Fails (Same Profile ID)

If you see the **same provisioning profile ID** in the error (like `1769069897490`), EAS is still using the cached profile. Try these more aggressive steps:

### Option 1: Complete Credential Regeneration (May Not Work)

**Note:** If EAS keeps saying "Updated existing profile" with the same ID, this won't work. Use Option 2 instead.

1. **Delete ALL credentials for development profile:**
   ```bash
   eas credentials -p ios
   ```
   - Select "Build Credentials"
   - Select "development" profile
   - Select **"Provisioning Profile: Delete one from your project"**
   - Delete the Ad Hoc profile
   - Then select **"All: Set up all the required credentials to build your project"**

2. **Rebuild:**
   ```bash
   eas build --profile development --platform ios --clear-cache
   ```

**If it still says "Updated existing profile" with the same ID, you MUST use Option 2 (manual deletion in Developer Portal).**

### Option 2: Manual Profile Deletion in Developer Portal (REQUIRED)

**This is the solution when EAS keeps "updating" the same profile instead of creating a new one.**

The problem: EAS finds an existing profile in Apple's Developer Portal (ID: `1769069897490`) and just updates it, rather than creating a new one. Since that profile was created before Family Controls was enabled, updating it won't add the capability.

**Steps:**

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles** → **Profiles**
3. Search for profiles containing: `com.juliemaitre.studyleague` and `AdHoc`
4. Find the profile: `*[expo] com.juliemaitre.studyleague AdHoc 1769069897490` (or similar with Developer Portal ID `F9AHF72C8T`)
5. **Click on the profile** to view details
6. **Click "Delete"** or the trash icon to permanently delete it
7. **Confirm deletion**

8. Now rebuild - EAS will be forced to create a brand new profile:
   ```bash
   eas build --profile development --platform ios --clear-cache
   ```

9. When EAS asks to create a new profile, it should include the Family Controls capability since it's now enabled in your App ID.

**Why this works:** By deleting the old profile, EAS can't "update" it anymore and must create a new one. The new profile will be generated based on your current App ID capabilities, which includes Family Controls.

### Option 3: Force Capability Sync

Sometimes EAS doesn't detect capability changes. Try:

1. **Wait 15-20 minutes** after enabling the capability (Apple propagation time)
2. **Verify in Developer Portal** that Family Controls is definitely enabled
3. **Rebuild with cache cleared:**
   ```bash
   eas build --profile development --platform ios --clear-cache
   ```

### Option 4: Contact EAS Support

If none of the above works:
- EAS Build service may need to refresh its credential cache
- Contact Expo support with:
  - Your project: `@juliemaitre/studyleague`
  - The provisioning profile ID: `1769069897490`
  - Confirmation that Family Controls is enabled in Developer Portal
