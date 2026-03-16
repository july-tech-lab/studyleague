# Build & Run Guide

## Quick Summary

| Goal | Command |
|------|---------|
| **Develop locally** | `npm start` → press `a` (Android) or `i` (iOS) |
| **Build for device/testers** | `eas build --profile development --platform android` |
| **Build for App Store / Play Store** | `eas build --profile production --platform all` |
| **Submit to stores** | `eas submit --platform android --latest` (or `ios`) |
| **Check env vars** | `eas env:list` |

---

## 1. Daily Development

```bash
npm start
```

Then press **a** for Android emulator or **i** for iOS simulator. JS/TS changes load via hot reload—no rebuild needed.

**When do you need a new build?** Only when you change native code (`modules/focus-module/`, plugins, `app.json`). Regular code changes don't require rebuilding.

---

## 2. First-Time Setup & Device Testing

### Environment variables (required for EAS builds)

Your app needs Supabase. Local development uses `.env`; EAS builds use cloud env vars.

**Set them once:**
```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "your_supabase_url" --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_supabase_anon_key" --environment production
```

When prompted for visibility, choose **Plain text** (these values go in the app bundle anyway).

**Verify:**
```bash
eas env:list
```
Select `production` to see your vars.

### Development build (for physical device)

```bash
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

Install the generated APK/IPA on your device via the download link or QR code.

---

## 3. Public Release (App Store / Play Store)

### Prerequisites
- **Apple**: [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
- **Android**: [Google Play Console](https://play.google.com/console/) ($25 one-time)

### Pre-build checklist

1. **Commit & push:**
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git push origin main
   ```

2. **Verify env vars:** `eas env:list` (production should show both Supabase vars)

3. **Confirm .env is not committed:** `git ls-files | grep .env` → should return nothing

### Build

```bash
eas build --profile production --platform all
```

### Submit (after builds complete)

```bash
eas submit --platform android --latest
eas submit --platform ios --latest
```

### Store setup

In **Play Console** and **App Store Connect**: add screenshots, description, privacy policy, and pricing. Both stores review before publishing (typically hours to a few days).

---

## 4. Build Profiles

| Profile | Use case |
|---------|----------|
| **development** | Testing on device with dev tools |
| **preview** | Internal testers (TestFlight / internal track) |
| **production** | App Store / Play Store |

---

## 5. Common Commands

```bash
# Development
npm start
npm run android
npm run ios

# Building
eas build --profile development --platform android
eas build --profile production --platform all

# Submitting
eas submit --platform android --latest

# EAS
eas env:list
eas build:list
```

---

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | Check `eas env:list` has both Supabase vars for production |
| App won't start locally | Clear cache: `npx expo start -c` |
| Gradle / native issues | Run `npx expo prebuild` and ensure Android Studio SDK is installed |
| iOS Family Controls error | Run `eas credentials -p ios` and regenerate provisioning profile |

---

## 7. Important Reminders

- **Commit before building** — EAS builds from your git repo
- **Never commit `.env`** — Use `eas env:create` for builds
- **Test locally first** — Saves build time and credits
