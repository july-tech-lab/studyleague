# Quick Fix: Java 17 Installation for Android Studio

You're getting this error because Gradle needs Java 17, but it's not installed on your system.

## Quick Solution (5 minutes)

### Step 1: Open Android Studio Settings

1. Open Android Studio
2. Go to: **File → Settings** (or press `Ctrl + Alt + S`)
3. Navigate to: **Build, Execution, Deployment → Build Tools → Gradle**

### Step 2: Download Java 17

1. Look for the **"Gradle JDK"** dropdown at the top
2. Click the dropdown - you'll see options like "Project SDK" or other versions
3. Click **"Download JDK..."** at the bottom of the dropdown
4. In the popup:
   - **Version**: Select **17**
   - **Vendor**: Choose **"Eclipse Temurin"** (recommended) or any other
   - Click **"Download"**
5. Wait for the download to complete (this may take a few minutes)

### Step 3: Select Java 17

1. After download completes, click the **"Gradle JDK"** dropdown again
2. You should now see **"jbr-17"** or **"jdk-17"** in the list
3. Select it
4. Click **"Apply"** then **"OK"**

### Step 4: Sync Gradle

1. Go to: **File → Sync Project with Gradle Files**
2. Wait for the sync to complete
3. The error should now be resolved!

## Alternative: If Download Doesn't Work

If Android Studio's download doesn't work, install Java 17 manually:

1. **Download Java 17:**
   - Go to: https://adoptium.net/temurin/releases/?version=17
   - Download the Windows x64 `.msi` installer
   - Run the installer and follow the prompts

2. **Set JAVA_HOME:**
   - Press `Win + X` → **System** → **Advanced system settings**
   - Click **"Environment Variables"**
   - Under **"System variables"**, click **"New"**
   - Variable name: `JAVA_HOME`
   - Variable value: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot` (or wherever it installed)
   - Click **OK**

3. **Add to PATH:**
   - In Environment Variables, find **"Path"** under System variables
   - Click **"Edit"** → **"New"**
   - Add: `%JAVA_HOME%\bin`
   - Click **OK** on all dialogs

4. **Restart Android Studio** and try syncing again

## Verify It Works

After installation, you can verify:

1. Open a new PowerShell window
2. Run: `java -version`
3. Should show: `openjdk version "17.x.x"` or similar

## Still Having Issues?

- Make sure you **restarted Android Studio** after installation
- Try: **File → Invalidate Caches → Invalidate and Restart**
- Check that the JDK path in **File → Project Structure → SDK Location** points to Java 17
