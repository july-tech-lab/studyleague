# Build Setup Guide

## Environment Variables

### Local Development

1. Create a `.env` file in the root directory:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

2. Replace the placeholder values with your actual Supabase credentials.

3. The `.env` file is already in `.gitignore` and will not be committed to git.

### EAS Build (Production)

For EAS builds, you need to set environment variables as secrets:

1. **Set secrets for all build profiles:**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your_supabase_url"
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_supabase_anon_key"
   ```

2. **Or set secrets for specific build profiles:**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your_supabase_url" --type string
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_supabase_anon_key" --type string
   ```

3. **Verify secrets are set:**
   ```bash
   eas secret:list
   ```

## Git Steps Before Build

Before building your app, follow these git steps:

### 1. Check Current Status
```bash
git status
```

### 2. Review Uncommitted Changes
Make sure you want to commit all changes:
- `app/(auth)/fill-profile.tsx`
- `app/(tabs)/index.tsx`
- `i18n/locales/en.json`
- `i18n/locales/fr.json`
- `plugins/withFocusMode.js`
- `utils/supabase.ts` (now uses env vars)
- `app.config.js` (new file)

### 3. Stage and Commit Changes
```bash
# Stage all changes
git add .

# Or stage specific files
git add app/ i18n/ plugins/ utils/ app.config.js

# Commit with a descriptive message
git commit -m "Configure environment variables for Supabase"
```

### 4. Push to Remote (if needed)
```bash
git push origin main
```

### 5. Verify Sensitive Files Are Not Committed
Double-check that these files are NOT in git:
- `.env` (should be gitignored)
- Any files containing hardcoded API keys or secrets

You can verify with:
```bash
git ls-files | grep -E "\.env$|supabase"
```

## Building the App

### Development Build
```bash
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

### Preview Build
```bash
eas build --profile preview --platform ios
# or
eas build --profile preview --platform android
```

### Production Build
```bash
eas build --profile production --platform ios
# or
eas build --profile production --platform android
```

## Important Notes

- **Never commit `.env` files** - They contain sensitive credentials
- **Always set EAS secrets** before building for production
- **Test locally first** - Make sure your `.env` file works before building
- The app will throw an error if environment variables are missing, preventing builds with missing credentials
