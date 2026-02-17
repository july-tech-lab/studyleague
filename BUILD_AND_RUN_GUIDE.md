# Complete Build, Run & Git Workflow Guide

This guide covers the entire process from development to production for iOS and Android builds.

## Table of Contents
1. [Local Development (Run)](#local-development-run)
2. [Building for iOS](#building-for-ios)
3. [Building for Android](#building-for-android)
4. [Git Workflow](#git-workflow)
5. [Complete Workflow Examples](#complete-workflow-examples)

---

## Local Development (Run)

### Prerequisites
- Node.js installed
- For iOS: Xcode and iOS Simulator (macOS only)
- For Android: Android Studio and Android Emulator
- Expo CLI installed globally: `npm install -g expo-cli eas-cli`

### Running Locally

#### Start Development Server
```bash
npm start
# or
expo start
```

#### Run on iOS Simulator (macOS only)
```bash
npm run ios
# or
expo run:ios
```

#### Run on Android Emulator
```bash
npm run android
# or
expo run:android
```

#### Run on Web
```bash
npm run web
# or
expo start --web
```

---

## Building for iOS

### What is a Development Client?

A **development client** is a custom-built version of your app that includes:
- **Custom native modules** - Your app has a custom `FocusModule` (iOS/Android native code)
- **Development tools** - Hot reloading, debugging, and fast refresh
- **Native debugging** - Ability to debug native code (Swift/Kotlin)

**Why is it required?**
- Your project uses **custom native code** (`modules/focus-module/`) for Focus Mode
- Standard Expo Go app **cannot run custom native modules**
- Development builds compile your native code into the app

**Development Client vs Preview/Production:**
- **Development**: Includes dev tools, Debug build, requires `expo-dev-client`
- **Preview**: Release build, no dev tools, can test on TestFlight
- **Production**: Release build, optimized, ready for App Store

### Build Profiles Available

Your `eas.json` defines three build profiles:

1. **development** - For development/testing with development client (requires `expo-dev-client`)
2. **preview** - For internal testing (TestFlight/Internal distribution)
3. **production** - For App Store submission

### iOS Build Commands

#### Without Profile (Interactive)
If you don't specify a profile, EAS will prompt you to choose:
```bash
eas build --platform ios
# EAS will ask: "Which build profile would you like to use?"
# Options: development, preview, production
```

#### Development Build

**Important: If you get Family Controls capability errors**, you need to regenerate credentials first:

```bash
# Step 1: Regenerate iOS credentials to include Family Controls capability
eas credentials -p ios

# In the interactive menu:
# 1. Select your project: @juliemaitre/studyleague
# 2. Select "development" or "All" credentials
# 3. Choose to remove/regenerate the provisioning profile
# 4. EAS will create a new profile with Family Controls capability

# Step 2: Build with cleared cache
eas build --profile development --platform ios --clear-cache
```

**Regular development build** (after credentials are fixed):
```bash
eas build --profile development --platform ios
```

#### Preview Build (TestFlight)
```bash
eas build --profile preview --platform ios
```

#### Production Build (App Store)
```bash
eas build --profile production --platform ios
```

**Note:** If you run `eas build --platform ios` in a non-interactive environment (like CI/CD), it will default to the **production** profile.

### iOS Build Notes
- All builds are **device builds** (not simulator) - `"simulator": false` in config
- Development builds use `Debug` configuration
- Preview and Production use `Release` configuration
- Production builds auto-increment version numbers

---

## Building for Android

### Android Build Commands

#### Without Profile (Interactive)
If you don't specify a profile, EAS will prompt you to choose:
```bash
eas build --platform android
# EAS will ask: "Which build profile would you like to use?"
# Options: development, preview, production
```

#### Development Build
```bash
eas build --profile development --platform android
```

#### Preview Build (Internal Testing)
```bash
eas build --profile preview --platform android
```

#### Production Build (Play Store)
```bash
eas build --profile production --platform android
```

**Note:** If you run `eas build --platform android` in a non-interactive environment (like CI/CD), it will default to the **production** profile.

### Android Build Notes
- Package name: `com.juliemaitre.studyleague`
- Edge-to-edge enabled
- All builds are device builds

---

## Git Workflow

### Before Building: Pre-Build Checklist

#### 1. Check Current Status
```bash
git status
```

#### 2. Review Changes
Make sure you understand what you're committing:
- Code changes
- Configuration changes
- New files
- Deleted files

#### 3. Stage Changes
```bash
# Stage all changes
git add .

# OR stage specific files/directories
git add app/ components/ utils/ i18n/
```

#### 4. Commit Changes
```bash
git commit -m "Your descriptive commit message"
```

**Good commit message examples:**
- `"Add user profile screen"`
- `"Fix authentication flow"`
- `"Update dependencies"`
- `"Configure EAS build settings"`

#### 5. Push to Remote
```bash
git push origin main
```

#### 6. Verify Sensitive Files Are NOT Committed
```bash
# Check that .env is not tracked
git ls-files | grep .env

# Should return nothing (or only .env.example)
```

**Files that should NEVER be committed:**
- `.env` (contains secrets)
- `*.p8`, `*.p12`, `*.key` (certificates)
- `*.jks` (Android keystores)
- `*.mobileprovision` (iOS provisioning profiles)

---

## Complete Workflow Examples

### Workflow 1: Local Development → Test on Device

```bash
# 1. Start development
git checkout -b feature/new-feature

# 2. Make your changes
# ... edit files ...

# 3. Test locally
npm start
# Then press 'i' for iOS or 'a' for Android

# 4. Commit changes
git add .
git commit -m "Add new feature"

# 5. Build for device testing
eas build --profile development --platform ios
# or
eas build --profile development --platform android

# 6. Install build on device via QR code or download link
```

### Workflow 2: Development → Preview Build → Production

```bash
# 1. Ensure all changes are committed
git status
git add .
git commit -m "Prepare for preview build"
git push origin main

# 2. Build preview version
eas build --profile preview --platform ios
eas build --profile preview --platform android

# 3. Test preview builds thoroughly

# 4. If everything works, build for production
eas build --profile production --platform ios
eas build --profile production --platform android

# 5. Submit to stores (after production builds complete)
eas submit --platform ios
eas submit --platform android
```

### Workflow 3: Hotfix → Quick Production Build

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-bug

# 2. Fix the issue
# ... make changes ...

# 3. Test locally
npm start

# 4. Commit and push
git add .
git commit -m "Fix critical bug"
git push origin hotfix/critical-bug

# 5. Merge to main
git checkout main
git merge hotfix/critical-bug
git push origin main

# 6. Build production
eas build --profile production --platform ios
eas build --profile production --platform android
```

---

## Environment Variables Setup

### For Local Development
1. Create `.env` file:
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### For EAS Builds
Set secrets before building:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your_url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_key"
```

Verify secrets:
```bash
eas secret:list
```

---

## Build Status & Downloads

After starting a build, EAS will:
1. Show build progress in terminal
2. Provide a build URL to track progress
3. Send notification when complete
4. Provide download link or QR code

View all builds:
```bash
eas build:list
```

---

## Common Commands Reference

### Development
```bash
npm start              # Start Expo dev server
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
npm run web           # Run on web
```

### Building
```bash
# iOS
eas build --profile development --platform ios
eas build --profile preview --platform ios
eas build --profile production --platform ios

# Android
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android

# Both platforms
eas build --profile production --platform all
```

### Git
```bash
git status                    # Check status
git add .                     # Stage all
git commit -m "message"       # Commit
git push origin main          # Push to remote
git pull origin main          # Pull latest
```

### EAS
```bash
eas build:list                # List all builds
eas secret:list               # List secrets
eas secret:create             # Create secret
eas submit --platform ios     # Submit to App Store
eas submit --platform android # Submit to Play Store
```

---

## Troubleshooting

### Build Fails
1. Check EAS secrets are set: `eas secret:list`
2. Verify environment variables in code
3. Check build logs: `eas build:view [build-id]`
4. Ensure all dependencies are in `package.json`

### Git Issues
1. Check `.gitignore` includes `.env`
2. Verify no secrets in committed files
3. Use `git status` to see what's changed

### Local Run Issues
1. Clear cache: `expo start -c`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check environment variables in `.env`

---

## Quick Decision Tree

**Want to test locally?**
→ `npm start` then press `i` (iOS) or `a` (Android)

**Want to test on physical device?**
→ `eas build --profile development --platform [ios|android]`

**Want to share with testers?**
→ `eas build --profile preview --platform [ios|android]`

**Ready for App Store/Play Store?**
→ `eas build --profile production --platform [ios|android]`
→ Then `eas submit --platform [ios|android]`

---

## Important Reminders

✅ **Always commit before building** - EAS builds from your git repository
✅ **Never commit `.env` files** - Use EAS secrets instead
✅ **Test locally first** - Saves time and build credits
✅ **Use preview builds** - Test before production
✅ **Check build status** - Monitor via `eas build:list` or EAS dashboard
