# Cleanup and Start Guide

## Step 1: Stop Stuck Processes

### In Android Studio:
1. **Stop any running builds:**
   - Click the **Stop** button (square icon) in the status bar
   - Or go to **Build → Cancel Build**

2. **Close the Android project:**
   - **File → Close Project**
   - Keep Android Studio open only for the emulator (Device Manager)

3. **Disable auto-sync (optional):**
   - **File → Settings** (Ctrl + Alt + S)
   - **Build, Execution, Deployment → Build Tools → Gradle**
   - Uncheck **"Sync project with Gradle files automatically"**
   - Click **Apply → OK**

### In Cursor:
1. **Reload the window:**
   - Press `Ctrl + Shift + P`
   - Type "Reload Window" and press Enter
   - This applies the Gradle exclusion settings

2. **Dismiss any Gradle notifications:**
   - Click the X on any "Initializing Gradle Language Server" notifications

## Step 2: Clean Up (Optional but Recommended)

### Clear Expo cache:
```bash
npx expo start -c
```

### Clear Metro bundler cache:
```bash
npm start -- --reset-cache
```

## Step 3: Verify Setup

### Check dependencies are installed:
```bash
npm install
```

### Verify environment variables:
- Make sure `.env` file exists with:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Step 4: Start the App

### Option A: Start Expo Dev Server (Recommended)
```bash
npm start
```

Then:
- Press `a` to open on Android emulator
- Or scan QR code with Expo Go (won't work with custom native modules)
- Or press `w` for web

### Option B: Use the Installed Development Build
1. Make sure Android emulator is running (via Android Studio Device Manager)
2. Open the "studyleague" app directly on the emulator
3. The app from your EAS build should already be installed

### Option C: Run with Expo CLI
```bash
npm run android
```
(This will start the emulator if not running and launch the app)

## Step 5: Verify Everything Works

✅ **Checklist:**
- [ ] Expo dev server starts without errors
- [ ] App opens on emulator
- [ ] No Gradle notifications in Cursor
- [ ] No stuck processes in Android Studio
- [ ] Hot reload works (make a small change, see it update)

## Troubleshooting

### If Gradle still runs:
- Close Android Studio completely
- Restart Cursor
- The `.vscode/settings.json` should prevent Gradle indexing

### If app won't start:
- Check emulator is running: `adb devices` (if adb is in PATH)
- Try clearing cache: `npx expo start -c`
- Check for errors in terminal

### If you need to work with native code:
- Only then should you open the project in Android Studio
- Run `npx expo prebuild` first to generate native folders
- But for regular Expo development, you don't need this

## Recommended Workflow Going Forward

1. **For development:**
   - Keep Android Studio closed (or only use Device Manager)
   - Use `npm start` in Cursor terminal
   - Press `a` for Android emulator

2. **For building:**
   - Use `eas build --profile development --platform android`
   - Don't need Android Studio open

3. **For native code changes:**
   - Only open Android Studio when modifying `modules/focus-module`
   - Otherwise, keep it closed
