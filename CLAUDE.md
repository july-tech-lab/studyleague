# Tymii

App mobile React Native / Expo (SDK ~54) + Supabase.
Suivi du temps d'étude, gamification (XP/streak), groupes sociaux.
Stack : expo-router, Supabase (auth, storage, realtime), i18n FR/EN.

## Conventions
- TypeScript strict
- Composants dans /components, hooks dans /hooks
- Migrations SQL dans **`/migrations`** (exécution manuelle dans le SQL Editor Supabase, sans obligation de CLI)
- Ne pas modifier app.json ni eas.json sans confirmation

## Priorités actuelles
- Préparer les builds EAS production
- Audit RLS Supabase
- Polish UI groupes + leaderboard