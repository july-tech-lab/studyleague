# Installation du SDK Android 36

## Problème
```
Failed to find target with hash string 'android-36' in: C:\Users\julie\AppData\Local\Android\Sdk
```

## Solution : Installer le SDK Android 36

### Méthode 1 : Via Android Studio (Recommandé) ⭐

**Étapes détaillées :**

1. **Ouvrir le SDK Manager dans Android Studio**
   - Dans Android Studio : **Tools → SDK Manager** (ou appuyez sur `Ctrl + Alt + S` puis allez dans **Appearance & Behavior → System Settings → Android SDK**)

2. **Installer Android 14.0 (API 36)**
   - Cliquez sur l'onglet **"SDK Platforms"** en haut
   - **IMPORTANT** : Cliquez sur **"Show Package Details"** en bas à droite pour voir toutes les versions disponibles
   - Cherchez **"Android 14.0 (API 36)"** dans la liste
   - Si vous ne le voyez pas, faites défiler vers le bas ou utilisez la recherche
   - **Cochez la case** à côté de **"Android 14.0 (API 36)"**
   - Vous pouvez aussi cocher les sous-composants (sources, etc.) si vous le souhaitez
   - Cliquez sur **"Apply"** en bas à droite
   - Dans la fenêtre de confirmation, cliquez sur **"OK"**
   - **Attendez** que le téléchargement et l'installation se terminent (peut prendre plusieurs minutes)

3. **Installer les Build Tools 36.0.0**
   - Cliquez sur l'onglet **"SDK Tools"** en haut
   - Cliquez sur **"Show Package Details"** si nécessaire
   - Cherchez **"Android SDK Build-Tools 36.0.0"**
   - **Cochez la case** à côté
   - Cliquez sur **"Apply"** puis **"OK"**
   - Attendez la fin de l'installation

4. **Vérifier l'installation**
   - Retournez à l'onglet **"SDK Platforms"**
   - Vérifiez que **"Android 14.0 (API 36)"** est maintenant **coché** ✅
   - Cliquez sur **"OK"** pour fermer le SDK Manager

5. **Synchroniser le projet**
   - Dans Android Studio : **File → Sync Project with Gradle Files**
   - Attendez la fin de la synchronisation
   - L'erreur devrait maintenant disparaître

### Méthode 2 : Via la ligne de commande (Alternative)

Si Android Studio ne fonctionne pas ou si vous préférez la ligne de commande :

**Dans PowerShell :**

```powershell
# Votre SDK est à : C:\Users\julie\AppData\Local\Android\Sdk
$sdkPath = "C:\Users\julie\AppData\Local\Android\Sdk"

# Vérifier que cmdline-tools existe
$cmdlineTools = Get-ChildItem "$sdkPath\cmdline-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1

if ($cmdlineTools) {
    $sdkmanager = "$($cmdlineTools.FullName)\bin\sdkmanager.bat"
    
    # Installer Android 14.0 (API 36)
    Write-Host "Installation de Android 14.0 (API 36)..."
    & $sdkmanager "platforms;android-36" --sdk_root=$sdkPath
    
    # Installer Build Tools 36.0.0
    Write-Host "Installation de Build Tools 36.0.0..."
    & $sdkmanager "build-tools;36.0.0" --sdk_root=$sdkPath
} else {
    Write-Host "Erreur: cmdline-tools non trouvé. Utilisez Android Studio SDK Manager à la place."
}
```

**Note :** Si `cmdline-tools` n'est pas installé, installez-le d'abord via Android Studio :
- SDK Manager → SDK Tools → Cochez "Android SDK Command-line Tools (latest)"

### Vérification

Après l'installation, vérifiez que le SDK est bien installé :

1. **Dans Android Studio** : SDK Manager → SDK Platforms → Vérifiez que "Android 14.0 (API 36)" est **coché** ✅
2. **Vérifier le dossier** : Allez dans `C:\Users\julie\AppData\Local\Android\Sdk\platforms` et vérifiez qu'il y a un dossier `android-36`
3. **Synchroniser le projet** : **File → Sync Project with Gradle Files**
4. **Vérifier les erreurs** : L'erreur "Failed to find target with hash string 'android-36'" devrait disparaître

## Dépannage

### "Android 14.0 (API 36)" n'apparaît pas dans SDK Manager

1. **Vérifier les mises à jour** :
   - Dans SDK Manager, cliquez sur **"SDK Update Sites"** (icône en bas à gauche)
   - Assurez-vous que les sources sont activées
   - Cliquez sur **"Update"** si nécessaire

2. **Vérifier la version d'Android Studio** :
   - Help → About
   - Assurez-vous d'avoir une version récente (25.2.3.9 ou plus récent)

3. **Réinstaller les command-line tools** :
   - SDK Manager → SDK Tools
   - Décochez puis recochez "Android SDK Command-line Tools (latest)"
   - Cliquez Apply

### L'erreur persiste après l'installation

1. **Vérifier le chemin du SDK** :
   - File → Project Structure → SDK Location
   - Vérifiez que le chemin est : `C:\Users\julie\AppData\Local\Android\Sdk`

2. **Invalider les caches** :
   - File → Invalidate Caches...
   - Cochez toutes les options
   - Cliquez "Invalidate and Restart"

3. **Vérifier manuellement** :
   - Ouvrez l'explorateur de fichiers
   - Allez dans `C:\Users\julie\AppData\Local\Android\Sdk\platforms`
   - Vérifiez qu'il y a un dossier `android-36`
   - Si absent, réessayez l'installation via SDK Manager

4. **Redémarrer Android Studio** complètement après l'installation

## Configuration actuelle du projet

Le projet utilise (défini par Expo) :
- **compileSdk**: 36
- **targetSdk**: 36
- **minSdk**: 24
- **buildTools**: 36.0.0

Ces valeurs sont définies automatiquement par Expo SDK 54 et ne doivent pas être modifiées manuellement.
