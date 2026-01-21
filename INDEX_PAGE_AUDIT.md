# Audit Détaillé - Page Index (Timer Screen)

**Date:** $(date)
**Fichier analysé:** `app/(tabs)/index.tsx`

## Résumé des Problèmes Signalés

1. ❌ **Bouton démarrer pas fonctionnel**
2. ❌ **Onglet tâche pas fonctionnel**
3. ❌ **Choix sujet pas fonctionnel**
4. ✅ **Bouton + pour ajouter subject fonctionnel** (confirmé par l'utilisateur)

---

## 1. BOUTON DÉMARRER - Analyse Détaillée

### Code Actuel (lignes 181-184, 302-308)

```tsx
const handleStart = () => {
  if (isRunning) return;
  timerStart();
};

// Dans le render:
<Button
  title={t("timer.startButton")}
  variant="primary"
  onPress={handleStart}
  disabled={!hasValidSubject}
  fullWidth
/>
```

### Problèmes Identifiés

#### 🔴 Problème 1: Validation `hasValidSubject` peut être incorrecte

**Ligne 239-241:**
```tsx
const hasValidSubject = React.useMemo(() => {
  return !!findSubjectWithParent(subjectTree, selectedSubjectId);
}, [findSubjectWithParent, subjectTree, selectedSubjectId]);
```

**Analyse:**
- `findSubjectWithParent` est une fonction callback qui cherche dans `subjectTree`
- Si `subjectTree` est vide ou si `selectedSubjectId` est `null`, `hasValidSubject` sera `false`
- Le hook `useSubjects` a `autoSelectFirst: true`, donc normalement un sujet devrait être sélectionné automatiquement
- **MAIS**: Si aucun sujet n'existe, ou si le chargement échoue, `selectedSubjectId` peut rester `null`

#### 🔴 Problème 2: Le bouton peut être désactivé même avec un sujet valide

**Scénarios possibles:**
1. `subjectTree` est vide (pas de sujets chargés)
2. `selectedSubjectId` est `null` (pas de sélection)
3. `selectedSubjectId` ne correspond à aucun sujet dans `subjectTree` (sujet supprimé ou non chargé)

#### 🔴 Problème 3: Pas de feedback visuel si le bouton est désactivé

Le bouton est simplement désactivé sans explication claire pour l'utilisateur (sauf un texte d'aide conditionnel ligne 297-300).

### Solutions Recommandées

1. **Ajouter des logs de débogage** pour comprendre l'état:
   ```tsx
   console.log('Timer Start Debug:', {
     hasValidSubject,
     selectedSubjectId,
     subjectTreeLength: subjectTree.length,
     isRunning
   });
   ```

2. **Vérifier que `selectedSubject` existe** au lieu de seulement `hasValidSubject`:
   ```tsx
   const canStart = !isRunning && !!selectedSubject;
   ```

3. **Améliorer le feedback utilisateur** quand le bouton est désactivé

---

## 2. ONGLET TÂCHE - Analyse Détaillée

### Code Actuel (lignes 78, 318-325, 494-535)

```tsx
const [listTab, setListTab] = useState<"subjects" | "tasks">("subjects");

<Tabs
  options={[
    { value: "subjects", label: t("timer.tabSubjects", "Matières") },
    { value: "tasks", label: t("timer.tabTasks", "Tâches") },
  ]}
  value={listTab}
  onChange={setListTab}
/>

{listTab === "subjects" ? (
  // ... liste des sujets
) : (
  <FlatList
    ref={tasksListRef}
    data={tasks.filter((t) => t.status !== "done" && t.subjectId)}
    // ...
  />
)}
```

### Problèmes Identifiés

#### 🔴 Problème 1: Le composant Tabs semble correct

Le composant `Tabs` (lignes 318-325) utilise `onChange={setListTab}` qui devrait fonctionner. Vérifions le composant `Tabs` lui-même.

#### 🔴 Problème 2: Filtrage des tâches peut être trop restrictif

**Ligne 497:**
```tsx
data={tasks.filter((t) => t.status !== "done" && t.subjectId)}
```

**Analyse:**
- Filtre les tâches avec `status !== "done"` ET `subjectId` présent
- Si une tâche n'a pas de `subjectId`, elle n'apparaîtra pas
- Cela peut être intentionnel, mais peut aussi masquer des tâches valides

#### 🔴 Problème 3: Pas de gestion d'état de chargement pour les tâches

Contrairement à l'onglet "subjects" qui affiche un `ActivityIndicator` quand `subjectsLoading` est vrai (ligne 329-332), l'onglet "tasks" n'affiche pas d'indicateur de chargement.

#### 🔴 Problème 4: Le composant Tabs peut avoir un problème de style/rendu

Le composant `Tabs` utilise `Pressable` avec des styles. Si les styles ne sont pas correctement appliqués, les onglets peuvent ne pas être cliquables.

### Solutions Recommandées

1. **Vérifier que le composant Tabs fonctionne correctement** - tester avec des logs
2. **Ajouter un indicateur de chargement** pour l'onglet tasks
3. **Améliorer le filtrage** des tâches si nécessaire
4. **Ajouter des logs** pour déboguer le changement d'onglet

---

## 3. CHOIX SUJET - Analyse Détaillée

### Code Actuel (lignes 334-492)

Les sujets sont affichés dans une `FlatList` avec des `TouchableOpacity` pour la sélection.

### Problèmes Identifiés

#### 🔴 Problème 1: Sélection de sujet parent (lignes 351-369)

```tsx
<TouchableOpacity
  onPress={() => {
    if (isRunning && !isRowActive) return;
    setSelectedSubjectId(sub.id);
  }}
  disabled={disableRowInteraction}
>
```

**Analyse:**
- `setSelectedSubjectId` est appelé correctement
- Mais `disableRowInteraction` peut bloquer l'interaction si le timer est en cours
- Si `isRunning` est `true` et que la ligne n'est pas active, l'interaction est désactivée

#### 🔴 Problème 2: Sélection de sous-sujet (lignes 420-435)

```tsx
<TouchableOpacity
  onPress={() => {
    setSelectedSubjectId(child.id);
  }}
  disabled={isRunning && !childSelected}
>
```

**Analyse:**
- Même problème: si le timer est en cours, seuls les sujets déjà sélectionnés peuvent être cliqués
- **MAIS** si le timer n'est pas en cours, cela devrait fonctionner

#### 🔴 Problème 3: Le hook `useSubjects` peut ne pas mettre à jour correctement

**Dans `useSubjects.ts` (lignes 50, 72-79):**
- `selectedSubjectId` est un state local dans le hook
- `setSelectedSubjectId` est une fonction qui met à jour ce state
- Si le hook ne se met pas à jour correctement, la sélection peut ne pas fonctionner

#### 🔴 Problème 4: `selectedSubject` peut être null même avec un `selectedSubjectId`

**Ligne 170-172 dans `useSubjects.ts`:**
```tsx
const selectedSubject = useMemo(() => {
  return subjects.find((s) => s.id === selectedSubjectId) ?? null;
}, [subjects, selectedSubjectId]);
```

**Analyse:**
- Si `selectedSubjectId` existe mais n'est pas dans la liste `subjects`, `selectedSubject` sera `null`
- Cela peut arriver si:
  - Le sujet a été supprimé
  - Le sujet n'a pas été chargé correctement
  - Il y a un décalage entre `selectedSubjectId` et `subjects`

### Solutions Recommandées

1. **Ajouter des logs** pour voir si `setSelectedSubjectId` est appelé et avec quelle valeur
2. **Vérifier que `selectedSubject` se met à jour** après la sélection
3. **Vérifier que le timer n'est pas en cours** quand on essaie de sélectionner un sujet
4. **Améliorer le feedback visuel** pour montrer que la sélection a fonctionné

---

## 4. BOUTON + POUR AJOUTER SUBJECT - ✅ FONCTIONNEL

### Code Actuel (lignes 562-573, 576-611)

Le bouton d'ajout et la modal fonctionnent correctement selon l'utilisateur. Pas d'analyse nécessaire.

---

## PROBLÈMES GÉNÉRAUX IDENTIFIÉS

### 🔴 Problème 1: Dépendances manquantes dans les useMemo/useCallback

Plusieurs `useMemo` et `useCallback` peuvent avoir des dépendances manquantes, ce qui peut causer des bugs de mise à jour.

### 🔴 Problème 2: Pas de gestion d'erreur visible

Si les hooks échouent (par exemple, `useSubjects` ou `useTasks`), l'utilisateur ne voit pas d'erreur claire.

### 🔴 Problème 3: États de chargement non gérés partout

L'onglet "tasks" n'a pas d'indicateur de chargement, contrairement à l'onglet "subjects".

### 🔴 Problème 4: Validation insuffisante

La validation `hasValidSubject` peut être trop stricte ou ne pas refléter correctement l'état réel.

---

## PLAN D'ACTION RECOMMANDÉ

### Priorité 1: Débogage et Logs
1. Ajouter des `console.log` stratégiques pour comprendre l'état:
   - Dans `handleStart` pour voir si elle est appelée
   - Dans `setSelectedSubjectId` pour voir les changements
   - Dans le render pour voir les valeurs de `hasValidSubject`, `selectedSubjectId`, etc.

### Priorité 2: Corrections des Bugs
1. **Bouton démarrer:**
   - Vérifier que `selectedSubject` existe au lieu de seulement `hasValidSubject`
   - Améliorer le feedback utilisateur

2. **Onglet tâche:**
   - Ajouter un indicateur de chargement
   - Vérifier que le composant `Tabs` fonctionne correctement

3. **Choix sujet:**
   - Vérifier que `setSelectedSubjectId` met à jour correctement l'état
   - S'assurer que le timer n'est pas en cours quand on essaie de sélectionner

### Priorité 3: Améliorations UX
1. Ajouter des messages d'erreur clairs
2. Améliorer les états de chargement
3. Améliorer le feedback visuel pour les interactions

---

## POINTS À VÉRIFIER EN PRIORITÉ

1. ✅ **Vérifier que `user?.id` existe** - Si l'utilisateur n'est pas connecté, rien ne fonctionnera
2. ✅ **Vérifier que `subjectTree` n'est pas vide** - Si aucun sujet n'est chargé, rien ne fonctionnera
3. ✅ **Vérifier que `selectedSubjectId` est défini** - Si aucun sujet n'est sélectionné, le bouton démarrer sera désactivé
4. ✅ **Vérifier que le composant `Tabs` fonctionne** - Tester le changement d'onglet
5. ✅ **Vérifier que `setSelectedSubjectId` met à jour l'état** - Tester la sélection de sujet

---

## COMMANDES DE DÉBOGAGE RECOMMANDÉES

Ajouter ces logs temporaires pour comprendre les problèmes:

```tsx
// Dans le render, avant le return
console.log('=== INDEX PAGE DEBUG ===');
console.log('user?.id:', user?.id);
console.log('selectedSubjectId:', selectedSubjectId);
console.log('selectedSubject:', selectedSubject);
console.log('hasValidSubject:', hasValidSubject);
console.log('subjectTree.length:', subjectTree.length);
console.log('isRunning:', isRunning);
console.log('listTab:', listTab);
console.log('tasks.length:', tasks.length);
```

---

## CONCLUSION

Les problèmes semblent être liés à:
1. **État non synchronisé** entre les hooks et le composant
2. **Validation trop stricte** pour le bouton démarrer
3. **Manque de feedback** pour comprendre pourquoi quelque chose ne fonctionne pas
4. **Problèmes potentiels** avec le composant `Tabs` ou son utilisation

Il est recommandé d'ajouter des logs de débogage d'abord pour identifier précisément où se situent les problèmes, puis de corriger les bugs identifiés.
