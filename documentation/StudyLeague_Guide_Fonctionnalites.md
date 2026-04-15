# 🏆 Tymii — Guide des Fonctionnalités



## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Authentification](#authentification)
3. [Onboarding (compléter le profil)](#onboarding-compléter-le-profil)
4. [Focus & minuteur](#focus--minuteur)
5. [Tâches](#tâches)
6. [Objectifs hebdomadaires](#objectifs-hebdomadaires)
7. [Statistiques & tableau de bord](#statistiques--tableau-de-bord)
8. [Groupes & classement](#groupes--classement)
9. [Profil, XP & paramètres](#profil-xp--paramètres)
10. [Carte des écrans](#carte-des-écrans)

---

## Vue d'ensemble

Tymii est une application mobile (**React Native / Expo**) de suivi du temps d'étude. Elle permet notamment de :

- ⏱️ Chronométrer des sessions par matière (et éventuellement par tâche)
- ✅ Gérer des tâches avec progression et temps enregistré
- 🎯 Définir des objectifs par matière (global hebdo et/ou détail par jour de la semaine)
- 📊 Consulter un tableau de bord (temps, streak, répartition, objectif vs réel)
- 👥 Rejoindre ou créer des groupes d'étude, avec un classement
- ⭐ Gagner de l'**XP** et un **niveau** ; suivre les **streaks**
- 🌙 Choisir le **thème** (clair / sombre) et la **langue** (FR / EN)

---

## Authentification

Parcours disponibles dans le groupe de routes `(auth)` :

| Écran | Rôle |
|-------|------|
| Connexion | Email et mot de passe |
| Inscription | Création de compte |
| Mot de passe oublié | Demande de réinitialisation |
| Vérification e-mail | Suite à l'inscription / renvoi si besoin |
| Réinitialisation (complète) | Après clic sur le lien reçu par mail |

Tant que l'utilisateur est connecté mais n'a pas terminé l'onboarding profil, l'app redirige vers **Compléter le profil**.

---

## Onboarding (compléter le profil)

L'écran **Compléter le profil** (`fill-profile`) guide l'utilisateur après la première connexion, en **deux étapes** principales.

### Étape 1 — Identité

- **Nom affiché** (obligatoire pour continuer)
- **Photo de profil** (optionnelle), via le sélecteur d'images de l'appareil

### Étape 2 — Parcours scolaire

- **Catégorie** : Primaire, Collège, Lycée, Prépa, Université, Autres  
- **Année / niveau** : les choix proposés dépendent de la catégorie
- **Spécialités (lycée)** : pour les niveaux qui le requièrent (ex. Première / Terminale), sélection du nombre de spécialités attendu ; les matières correspondantes sont issues du catalogue applicatif

### Matières par défaut

À la validation, le client attache ou crée les matières prévues par le **catalogue** et le **parcours** (clés `bank_key` côté base), comme dans StudyTracker, mais avec le modèle de catégories Tymii (`primaire`, `college`, `lycee`, etc.).

### Données profil associées

Le profil en base peut stocker notamment : `onboarding_completed`, `academic_category`, `academic_year_key`, `specialty_keys`. Le drapeau `onboarding_completed` passe à **true** une fois le flux terminé.

---

## Focus & minuteur

L'onglet **Focus** (`(tabs)/index`) est l'écran principal.

### Déroulement

1. **Choisir** une matière (arborescence / sélecteur) et éventuellement une **tâche** parmi les tâches actives (`planned`, `in-progress`)
2. **Démarrer** le minuteur
3. **Pause / reprise** selon l'implémentation UI du moment
4. **Arrêter** : la session est enregistrée côté Supabase

### Données enregistrées (`study_sessions`)

| Champ (conceptuel) | Description |
|--------------------|-------------|
| `started_at` / `ended_at` | Bornes de la session |
| `duration_seconds` | Durée en secondes |
| `subject_id` | Matière |
| `task_id` | Tâche liée (optionnel) |

Si une tâche est liée, le temps peut être ajouté via la RPC **`increment_task_seconds`** (incrément du temps passé sur la tâche).

### Module « Focus » système

Un module natif (**focus-module**) peut, sur iOS / Android, s'appuyer sur les contrôles parentaux / mode concentration. Dans la branche actuelle du minuteur, **l'exigence de mode Focus avant démarrage est désactivée** (configuration type publication store) ; le hook `useStudyMode` reste présent pour une réactivation ultérieure.

### Accès aux objectifs

L'écran **Objectifs** n'apparaît pas dans la barre d'onglets : il est **ouvert depuis l'écran Focus** (navigation vers `(tabs)/goals`).

---

## Tâches

L'onglet **Tâches** (`(tabs)/tasks`) sert à organiser le travail à faire.

### Statuts

Le cycle inclut un statut **« en cours »** en plus du planifié et du terminé :

```
Création → planifiée (planned) / en cours (in-progress) → terminée (done)
                                              ↓
                                    réactivation → active
```

### Actions typiques

| Action | Description |
|--------|-------------|
| Ajouter | Titre, matière, durée prévue, date prévue optionnelle |
| Terminer | Passage en `done` |
| Réactiver | Remettre une tâche terminée en cours |
| Supprimer | Suppression définitive |

### Champs utiles

| Champ | Rôle |
|-------|------|
| `title` | Intitulé |
| `subject_id` | Matière |
| `planned_minutes` | Estimation |
| Temps enregistré | Mis à jour lors des sessions rattachées à la tâche |
| `status` | `planned`, `in-progress`, `done` |
| `scheduled_for` | Date prévue (optionnel) |

L'écran Focus ne liste en principe que les tâches **non terminées** pour l'association au minuteur.

---

## Objectifs hebdomadaires

L'écran **Objectifs** (`(tabs)/goals`) permet de fixer le temps par matière.

### Modes d'affichage

- **Par matière** : objectif hebdomadaire global (minutes) par matière parente
- **Par jour** : pour chaque matière, minutes cibles par jour de la semaine (lundi → dimanche), avec contrôles type curseur / palette de durées

Les données sont alignées sur les matières du profil et une source type **`subject_day_goals`** (matière × jour), cohérente avec le tableau de bord (prévu vs réel).

---

## Statistiques & tableau de bord

L'onglet **Stats** (`(tabs)/dashboard`) regroupe les indicateurs sur la période choisie.

### Filtres temporels

- **Semaine**, **Mois**, **Année**
- **Navigation** : semaine / mois / année précédente ou suivante (sans dépasser la période « courante »)

### Contenu principal

| Bloc | Description |
|------|-------------|
| Objectif hebdo | Barre de progression temps réel vs objectif cumulé (vue semaine) |
| Métriques | Temps total sur la période, **streak** (jours consécutifs), nombre de **sessions** |
| Répartition | Barres de pourcentage du temps par matière (données issues des sessions) |
| Progression quotidienne | Histogramme **réel vs prévu** (filtre par matière ou toutes les matières) |

Les totaux et histogrammes s'appuient sur les hooks de données (ex. `useDashboard`) branchés sur Supabase.

---

## Groupes & classement

### Groupes (`(tabs)/groups`)

- Création : nom, description, **visibilité** publique ou privée
- **Mot de passe / code** pour les groupes privés selon la configuration
- Option **approbation admin** avant qu'un membre rejoigne
- Rejoindre un groupe : recherche par code, ONGLET « groupes publics », etc.
- Modification des paramètres pour les groupes dont l'utilisateur est gestionnaire

### Classement (`(tabs)/leaderboard`)

Écran **non affiché dans la barre d'onglets** : accessible depuis l'expérience **Groupes** (navigation interne).

- Classement par période : **semaine**, **mois**, **année**
- Affichage des rangs et durées d'étude agrégées (données via requêtes type `fetchLeaderboardByPeriod`)

---

## Profil, XP & paramètres

L'onglet **Profil** (`(tabs)/profile`) concentre l'identité, la progression et les réglages.

### Progression

| Élément | Règle côté serveur (résumé) |
|---------|-----------------------------|
| **XP** | Gain principal = **minutes** étudiées à la complétion d'une session (`duration_seconds / 60`) |
| **Niveau** | Dérivé de l'XP cumulée (ex. niveau = 1 + floor(XP / 100) selon la migration projet) |
| **Streak** | Mis à jour lors des insertions de résumés journaliers : jours consécutifs avec au moins une activité |

Des bonus (ex. tâche terminée) peuvent compléter la formule selon les fonctions SQL déployées.

### Matières

- Arborescence (matières parentes / sous-matières) avec couleurs
- Ajout depuis la banque ou **création personnalisée**
- Masquage / dissociation du profil, suppression définitive sous conditions (pas de données bloquantes)

### Paramètres

| Paramètre | Options |
|-----------|---------|
| Langue | Français / English (synchronisée avec la préférence profil quand elle existe) |
| Thème | Clair / sombre |

### Compte

- **Déconnexion**
- **Suppression de compte** (action destructrice côté auth + données)

---

## Carte des écrans

Routes indicatives **Expo Router** (chemins logiques) :

| Route | Écran | Description |
|-------|--------|-------------|
| `/(auth)/signin` | Connexion | Email + mot de passe |
| `/(auth)/signup` | Inscription | Création de compte |
| `/(auth)/forgot-password` | Mot de passe oublié | Email de reset |
| `/(auth)/verify-email` | Vérification | Email |
| `/(auth)/reset-password-complete ...` | Fin de reset | Nouveau mot de passe |
| `/(auth)/fill-profile` | Onboarding | Identité + parcours + matières |
| `/(tabs)/` ou `/(tabs)/index` | Focus | Minuteur principal |
| `/(tabs)/tasks` | Tâches | Liste et gestion |
| `/(tabs)/goals` | Objectifs | Depuis Focus (pas dans la tab bar) |
| `/(tabs)/groups` | Groupes | Création / adhésion |
| `/(tabs)/leaderboard` | Classement | Depuis Groupes (pas dans la tab bar) |
| `/(tabs)/dashboard` | Stats | Tableau de bord |
| `/(tabs)/profile` | Profil | Stats perso, XP, matières, réglages |
| `/(tabs)/color-palette` | Palette (dev) | Visualisation thème — masquée dans la tab bar |
| `/modal` | Modale globale | Présentation modale (layout racine) |

---

*Document rédigé le 8 avril 2026 — Tymii (base documentaire alignée sur le dépôt applicatif Expo).*
