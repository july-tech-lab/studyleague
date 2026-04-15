🏗️ Architecture globale
Stack technologique
Frontend : React Native / Expo (SDK 54) + TypeScript strict
Backend : Supabase (auth, database, realtime)
Routing : expo-router
i18n : FR/EN (i18next)
Module natif : Focus Mode (Android/iOS)
Structure du projet

Flux d'authentification
Root Layout → Providers (Auth, Theme, i18n)
AuthContext → Gère user + session Supabase
Routes :
Non authentifié → (auth) group
Profile incomplet → fill-profile
Authentifié + profile OK → (tabs) group
Fonctionnalités principales
✅ Suivi du temps d'étude
✅ Système d'XP + streaks (gamification)
✅ Groupes sociaux + leaderboard
✅ Tâches/TODO par matière
✅ Mode Focus (module natif)
✅ Multi-langue (FR/EN)
✅ Auth Google/Apple + Email


Structure du Project
📁 app/                          # Routes (expo-router)
├── (auth)/                     # Groupe d'authentification
│   ├── signin, signup, fill-profile
│   ├── forgot-password, verify-email
│   └── reset-password-complete
├── (tabs)/                     # Groupe principal (tab navigation)
│   ├── index.tsx              # Dashboard principal
│   ├── dashboard.tsx          # Suivi d'étude
│   ├── tasks.tsx              # Tâches/TODO
│   ├── groups.tsx             # Groupes sociaux
│   ├── profile.tsx            # Profil utilisateur
│   ├── leaderboard.tsx        # Classement (XP/streak)
│   └── color-palette.tsx      # Dev/design

📁 components/                  # Composants réutilisables
├── ui/                         # Composants UI (Button, Input, Modal, etc.)
├── layout/                     # Composants de mise en page
└── planning/                   # Composants de planification

📁 hooks/                       # Logique métier (custom hooks)
├── useDashboard.ts            # Données dashboard
├── useTasks.ts                # Gestion des tâches
├── useGroups.ts               # Groupes et leaderboard
├── useProfile.ts              # Profil utilisateur
├── useTimer.ts                # Timer d'étude
├── useSubjects.ts             # Matières/sujets
├── useSubjectGoals.ts         # Objectifs par matière
└── useStudyMode.ts            # Mode concentration

📁 utils/                       # Utilitaires
├── authContext.tsx            # Auth + session (Supabase)
├── themeContext.tsx           # Thème dark/light
├── queries.ts                 # Requêtes Supabase (données)
├── supabase.ts                # Client Supabase
└── time.ts                    # Helpers temps

📁 i18n/                        # Internationalization
└── locales/
    ├── en.json
    └── fr.json

📁 modules/focus-module/        # Module natif Android
└── Android Kotlin

📁 migrations/                  # Schéma Supabase (SQL)