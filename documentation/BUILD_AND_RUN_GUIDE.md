# Build, run & environment setup

Single reference for local development, cleaning a stuck environment, EAS builds, and store release.

## Quick summary

| Goal | Command |
|------|---------|
| **Develop locally** | `npm start` → press `a` (Android) or `i` (iOS) |
| **Build for device/testers** | `eas build --profile development --platform android` |
| **Build for App Store / Play Store** | `eas build --profile production --platform all` |
| **Submit to stores** | `eas submit --platform android --latest` (or `ios`) |
| **Check env vars** | `eas env:list` |

---

## 1. First-time setup

### Local development (`.env`)

1. In the project root, create `.env`:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
2. Replace placeholders with your Supabase values (from the Supabase dashboard).
3. `.env` should stay gitignored — do not commit it.

### EAS builds (cloud env vars)

EAS builds do not use your local `.env`; set variables for the right **environment** (e.g. `production`, `development`).

**Example (production):**
```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "your_supabase_url" --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_supabase_anon_key" --environment production
```

When prompted for visibility, choose **Plain text** (these ship in the client bundle anyway).

**Verify:**
```bash
eas env:list
```
Select the environment you care about to confirm both Supabase vars are present.

---

## 2. Daily development

```bash
npm start
```

Press **a** for Android emulator or **i** for iOS simulator. JS/TS changes hot reload — no rebuild needed.

**When do you need a new build?** Only when native code changes (`modules/focus-module/`, plugins, `app.json`, etc.). Ordinary app code does not require a new binary.

**Other ways to run:**
- `npm run android` / `npm run ios` — can start the emulator/simulator and open the app.
- **Development build already on device:** start the emulator, open the Tymii dev build, and ensure the dev server is running (`npm start`) so it loads the bundle.
- **Expo Go:** limited; custom native modules may require a dev build instead.

---

## 3. Clean slate & stuck tools

Use this when Gradle/Android Studio or the editor feels stuck, or after odd cache issues.

### Android Studio

1. **Stop builds:** Stop button in the toolbar, or **Build → Cancel Build**.
2. **Close the Android project:** **File → Close Project** — keep the IDE open only for **Device Manager** if you use it.
3. **Optional — reduce auto-sync:** **File → Settings** → **Build, Execution, Deployment → Build Tools → Gradle** → uncheck **Sync project with Gradle files automatically** → **Apply**.

### Cursor / VS Code

1. **Reload window:** `Ctrl + Shift + P` → “Reload Window”.
2. Dismiss stuck “Initializing Gradle Language Server” notifications if they appear.

### Caches & dependencies

```bash
npm install
npx expo start -c          # clear Expo cache
npm start -- --reset-cache # Metro reset (alternative)
```

Confirm `.env` still exists with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### Quick checklist

- [ ] Dev server starts without errors
- [ ] App opens on emulator/device
- [ ] No stuck Gradle UI noise (or Android Studio closed when not needed)
- [ ] Hot reload works after a small edit

**If Gradle still spins in the editor:** close Android Studio, reload the editor; project `.vscode/settings.json` should limit Gradle indexing for this repo.

**Native work only when needed:** open Android Studio mainly when changing native code (e.g. `modules/focus-module`). For day-to-day JS/TS, `npm start` + emulator is enough. For local native folders, `npx expo prebuild` first — not required for normal managed workflow.

---

## 4. Git before EAS builds

EAS builds from your git remote; commit what you want in the build.

**Brand-new folder without git (unusual for this repo):** `git init`, add your remote (`git remote add origin …`), then:

```bash
git status
git add .
git commit -m "Your message"
git push origin main   # or your release branch
```

**Sensitive files:** ensure `.env` is not tracked:
```bash
git ls-files | grep -E "\.env$"   # should print nothing
```

---

## 5. Development build (physical device)

```bash
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

Install the artifact from the EAS download link or QR code.

---

## 6. Public release (App Store / Play Store)

### Prerequisites

- **Apple:** [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
- **Android:** [Google Play Console](https://play.google.com/console/) ($25 one-time)

### Pre-build checklist

1. Commit and push (see §4).
2. `eas env:list` — production (or target env) shows both Supabase vars.
3. `.env` not committed (command above).

### Build and submit

```bash
eas build --profile production --platform all
```

After builds finish:

```bash
eas submit --platform android --latest
eas submit --platform ios --latest
```

In **Play Console** and **App Store Connect**, add screenshots, description, privacy policy, and pricing. Review times vary (hours to a few days).

---

## 7. EAS Update (OTA / `expo-updates`)

Push JavaScript and asset changes to **already installed** builds without a new store binary (same **runtime** as defined in `app.json` — here `runtimeVersion` uses the `appVersion` policy).

### One-time (per machine / new contributor)

```bash
npm i -g eas-cli
eas login
```

Project expectations: `app.json` (or `app.config.js`) and an EAS project (`expo.extra.eas.projectId`). This repo already includes an `updates.url` and `eas.json` **channels** (`development`, `preview`, `production`) aligned with build profiles.

If you clone an older branch without that config, run:

```bash
npx expo install expo-updates
npx eas update:configure
npx eas build:configure
```

### First build with a channel

OTA only applies after users install a build that was produced with EAS and the matching channel. Use the same profiles as in §5 / §6, for example:

```bash
eas build --profile production --platform android
# or all / iOS as needed
```

### Publish an update (no new binary)

Target the **channel** that matches the installed app (`eas.json` → `build.*.channel`):

```bash
eas update --channel production --message "Describe the change"
eas update --channel preview --message "Internal test"
eas update --channel development --message "Dev client"
```

**Notes:** Steps 1–2 (CLI + login) are one-time. The first **channel** build is what enables updates on devices. If you need help choosing platform commands or profiles, use the same `eas.json` entries as for normal builds.

---

## 8. Build profiles

| Profile | Use case |
|---------|----------|
| **development** | Device testing with dev tools |
| **preview** | Internal testers (TestFlight / internal track) |
| **production** | Store release |

---

## 9. Common commands

```bash
# Development
npm start
npm run android
npm run ios

# Building
eas build --profile development --platform android
eas build --profile preview --platform ios
eas build --profile production --platform all

# Submitting
eas submit --platform android --latest

# EAS
eas env:list
eas build:list

# OTA (after a channel build is installed)
eas update --channel production --message "Your message"
```

---

## 10. Troubleshooting

| Issue | What to try |
|-------|----------------|
| EAS build fails | `eas env:list` for the target environment; both Supabase vars must be set |
| App won’t start locally | `npx expo start -c`; confirm `.env` keys |
| Missing env at runtime | App may error on boot if vars are absent — fix `.env` locally, EAS env remotely |
| Gradle / native oddities | `npx expo prebuild`; Android Studio SDK installed; only open Studio when working on native code |
| iOS Family Controls / signing | `eas credentials -p ios` and refresh provisioning profile |
| Emulator not showing app | `adb devices` (if `adb` on PATH); start emulator from Device Manager first |

---

## 11. Reminders

- **Commit before building** — EAS uses your repository state.
- **Never commit `.env`** — use `eas env:create` (or update vars in the EAS dashboard) for builds.
- **Test locally first** — saves build time and EAS usage.
- **Android Studio:** prefer closed or Device Manager–only for normal JS development; use full IDE when changing native modules.
