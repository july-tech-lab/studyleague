# Tymii — Vue d'ensemble

Tymii est une **application mobile** (React Native / Expo) de suivi du temps d'étude, pensée comme un « Strava pour les études ». Voici l'essentiel :

---

## Ce que ça fait

**Chronomètre de sessions** — le cœur de l'app. Tu choisis une matière, tu lances le timer, tu arrêtes quand tu as fini. La session est enregistrée automatiquement dans Supabase.

**Gestion de tâches** — tu peux créer des tâches rattachées à tes matières (`planned` → `in-progress` → `done`), et les lier à une session de travail pour suivre le temps passé dessus.

**Objectifs hebdomadaires** — tu fixes des durées cibles par matière et par jour de la semaine, et le dashboard compare ce que tu as réellement fait vs ce que tu avais prévu.

**Statistiques** — un tableau de bord avec le temps total, le streak (jours consécutifs d'étude), la répartition par matière, et une vue **réel vs prévu** (barres / histogramme selon la période).

**Groupes & classement** — tu peux rejoindre ou créer des groupes d'étude (**publics** ou **privés**), et te comparer aux autres membres via un leaderboard **semaine / mois / année**.

**Gamification** — chaque session validée **ajoute la durée à ton XP total** (côté serveur, au pas de la seconde) ; le **niveau** augmente par **palier d'environ une heure d'étude cumulée**. Les streaks récompensent la régularité.

---

## La technique en bref

| Couche       | Choix                                                |
| ------------ | ---------------------------------------------------- |
| Frontend     | React Native + Expo SDK 54                           |
| Navigation   | expo-router avec deux groupes : `(auth)` et `(tabs)` |
| Backend      | Supabase (PostgreSQL, Auth, Storage)                 |
| i18n         | i18next, FR / EN                                     |
| Plateformes  | iOS & Android                                        |

---

## Le parcours utilisateur

1. **Inscription** → vérification e-mail
2. **Onboarding** → pseudo / nom affiché, **catégorie** (Lycée, Prépa, Université…), **niveau**, **spécialités** (si lycéen)
3. **Matières par défaut** attachées automatiquement selon le parcours
4. **App** → timer, tâches, stats, groupes, profil

---

## État actuel (avril 2026)

- **Android** : chaîne de build prête pour une **soumission store** (sous réserve des exigences Play Console / compte éditeur).
- **iOS** : les builds avec **focus strict** reposent sur les capacités **Family Controls** (Screen Time) ; **l'acceptation Apple** (droits + **App Store Review**) peut bloquer ou retarder la publication tant que ce volet n'est pas validé.
- **Sécurité RLS (Supabase)** : **audit documenté en interne** avec couverture des tables principale et correctifs (notamment politiques **groupes** / membres) — détail dans [`TECH_STACK.md`](./TECH_STACK.md) §3.2.
- **Plans d'étude récurrents** : **spécifiés** (roadmap / guide d'implémentation) mais **pas encore livrés** dans l'app.
