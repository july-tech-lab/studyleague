# 📚 StudyTracker — Guide des Fonctionnalités

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Onboarding](#onboarding)
3. [Focus & Timer](#focus--timer)
4. [Tâches](#tâches)
5. [Objectifs hebdomadaires](#objectifs-hebdomadaires)
6. [Statistiques & Dashboard](#statistiques--dashboard)
7. [Groupes d'étude](#groupes-détude)
8. [Profil & Paramètres](#profil--paramètres)
9. [Carte des écrans](#carte-des-écrans)

---

## Vue d'ensemble

StudyTracker est une application de suivi du temps d'étude conçue pour les étudiants. Elle permet de :

- ⏱️ Chronométrer ses sessions de travail par matière
- ✅ Gérer ses tâches et suivre leur avancement
- 🎯 Définir des objectifs hebdomadaires par matière et par jour
- 📊 Visualiser ses statistiques (streaks, temps total, répartition)
- 👥 Rejoindre des groupes d'étude avec classement
- 🌙 Thème sombre / clair et support multilingue (FR / EN)

---

## Onboarding

L'onboarding guide l'utilisateur en **5 étapes** après la création de compte :

### Étape 1 — Choix de la filière

L'utilisateur choisit sa catégorie d'études parmi :

| Catégorie | Exemples |
|-----------|----------|
| Primaire | CE1, CE2, CM1, CM2 |
| Collège | 6ème à 3ème |
| Lycée | Seconde, Première, Terminale |
| CPGE | MPSI, PCSI, ECG… |
| Médecine | PASS, LAS, P2… |
| Droit & Sciences Po | L1 Droit, IEP… |
| Économie / Gestion / Commerce | L1 Éco, école de commerce… |
| Paramédical | IFSI, kiné… |
| Architecture & Design | ENSA, Beaux-Arts… |
| BTS / BUT / Lycée Pro | BTS, BUT, Bac Pro… |
| Autre | Saisie libre |

### Étape 2 — Choix de l'année/niveau

Les options sont filtrées en fonction de la filière choisie à l'étape 1.

### Étape 3 — Spécialités (Lycée uniquement)

Pour les élèves de **Première** et **Terminale**, une page supplémentaire permet de sélectionner ses spécialités :

- **Première** : 3 spécialités à choisir
- **Terminale** : 2 spécialités à choisir

Exemples : Mathématiques, Physique-Chimie, SVT, SES, HGGSP, NSI, HLP, LLCE…

### Étape 4 — Attribution automatique des matières

En fonction de la filière, de l'année et des spécialités, un jeu de matières par défaut est automatiquement ajouté au profil de l'utilisateur (table `user_subjects`).

### Étape 5 — Confirmation

L'utilisateur voit un récapitulatif et confirme. Le flag `onboarding_completed` passe à `true`.

---

## Focus & Timer

L'écran **Focus** (`/`) est l'écran principal de l'application.

### Fonctionnement

1. **Sélection** : Choisir une matière et/ou une tâche
2. **Démarrer** : Le chronomètre démarre
3. **Pause / Reprise** : Possibilité de mettre en pause
4. **Arrêter** : La session est sauvegardée automatiquement

### Données enregistrées

Chaque session crée une entrée dans `study_sessions` :

| Champ | Description |
|-------|-------------|
| `started_at` | Horodatage de début |
| `ended_at` | Horodatage de fin |
| `duration_seconds` | Durée totale en secondes |
| `subject_id` | Matière associée |
| `task_id` | Tâche associée (optionnel) |

Si une tâche est associée, son `logged_seconds` est automatiquement incrémenté via la fonction `increment_task_logged_seconds`.

### Mode Focus

Sur mobile natif (Capacitor), le mode Focus peut activer des fonctionnalités système pour réduire les distractions.

---

## Tâches

L'écran **Tâches** (`/tasks`) permet de gérer ses devoirs et révisions.

### Cycle de vie d'une tâche

```
Création → Active (planned) → Terminée (done)
                                    ↓
                              Réactivation → Active
```

### Actions disponibles

| Action | Description |
|--------|-------------|
| ➕ Ajouter | Créer une tâche avec titre, matière et durée prévue |
| ✏️ Modifier | Changer le titre, la matière ou la durée |
| ✅ Terminer | Marquer comme faite |
| 🔄 Réactiver | Remettre une tâche terminée en cours |
| 🗑️ Supprimer | Supprimer définitivement |

### Champs d'une tâche

| Champ | Type | Description |
|-------|------|-------------|
| `title` | texte | Nom de la tâche |
| `subject_id` | FK | Matière liée |
| `planned_minutes` | nombre | Durée estimée |
| `logged_seconds` | nombre | Temps réellement passé |
| `status` | texte | `planned` ou `done` |
| `scheduled_for` | date | Date prévue (optionnel) |

---

## Objectifs hebdomadaires

L'écran **Objectifs** (`/goals`) permet de définir des objectifs de temps d'étude.

### Deux modes de saisie

#### Par matière
Définir un objectif hebdomadaire global par matière (ex : 5h de Maths par semaine).

#### Par jour
Grille détaillée : pour chaque matière, définir les minutes prévues par jour de la semaine.

| | Lun | Mar | Mer | Jeu | Ven | Sam | Dim |
|---|---|---|---|---|---|---|---|
| Maths | 60 | 30 | 60 | 30 | 60 | 0 | 0 |
| Physique | 30 | 45 | 0 | 45 | 30 | 0 | 0 |

Les objectifs sont stockés dans `subject_day_goals` (un enregistrement par matière × jour).

---

## Statistiques & Dashboard

L'écran **Stats** (`/stats`) affiche un tableau de bord complet.

### Indicateurs principaux

| Indicateur | Description |
|------------|-------------|
| 🎯 Objectif hebdo | Progression vers l'objectif de la semaine |
| ⏱️ Temps total | Cumul de toutes les sessions |
| 🔥 Streak | Nombre de jours consécutifs d'étude |
| 📝 Sessions | Nombre total de sessions |

### Graphiques

- **Répartition par matière** : Camembert montrant la distribution du temps
- **Activité** : Heatmap de l'activité quotidienne
- **Objectif vs Réel** : Comparaison entre temps prévu et temps réel
- **Progression quotidienne** : Graphique en barres du temps par jour

### Records personnels

- Plus longue session
- Meilleure matière (temps cumulé)

### Filtres temporels

Les stats peuvent être filtrées par : **Semaine** | **Mois** | **Année**

---

## Groupes d'étude

L'écran **Groupes** (`/groups`) permet de rejoindre ou créer des groupes.

### Types de groupes

| Type | Description |
|------|-------------|
| Public | Visible par tous, rejoignable librement |
| Privé | Accès par code d'invitation uniquement |

### Fonctionnalités

- **Créer un groupe** : Nom, description, visibilité
- **Rejoindre** : Par code d'invitation ou depuis la liste publique
- **Classement** : Leaderboard hebdomadaire basé sur le temps d'étude
- **Membres** : Liste des membres avec leur temps d'étude

### Rôles

| Rôle | Permissions |
|------|-------------|
| `owner` | Gestion complète (suppression, modération) |
| `admin` | Gestion des membres |
| `member` | Participation au classement |

---

## Profil & Paramètres

L'écran **Profil** (`/profile`) regroupe les paramètres personnels.

### Sections

#### Informations personnelles
- Nom d'affichage
- Avatar (optionnel)

#### Matières
- Liste des matières actives avec badges colorés
- Ajouter une matière depuis la banque de matières prédéfinies
- Créer une matière personnalisée
- Archiver / Activer une matière
- Supprimer (uniquement si pas de sessions ou tâches liées)

#### Paramètres
| Paramètre | Options |
|-----------|---------|
| Langue | Français 🇫🇷 / English 🇬🇧 |
| Thème | Clair ☀️ / Sombre 🌙 |

#### Actions
- **Déconnexion** : Retour à l'écran de connexion
- **Supprimer le compte** : Suppression définitive (cascade sur toutes les données)

---

## Carte des écrans

| Route | Écran | Description |
|-------|-------|-------------|
| `/signin` | Connexion | Email + mot de passe |
| `/signup` | Inscription | Création de compte |
| `/forgot-password` | Mot de passe oublié | Envoi d'email de réinitialisation |
| `/reset-password` | Réinitialisation | Nouveau mot de passe |
| `/onboarding` | Onboarding | Configuration initiale (5 étapes) |
| `/` | Focus | Timer et chronomètre |
| `/tasks` | Tâches | Gestion des devoirs |
| `/goals` | Objectifs | Objectifs hebdomadaires |
| `/stats` | Dashboard | Statistiques et graphiques |
| `/groups` | Groupes | Groupes d'étude et classements |
| `/profile` | Profil | Paramètres et matières |

---

*Document généré le 8 avril 2026 — StudyTracker v1.0*
