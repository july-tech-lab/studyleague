# Tymii — Documentation fonctionnelle (User Stories)

Document simple : parcours **de l’inscription au chronomètre de session**, avec les **règles de gestion** principales telles qu’elles découlent du produit et du modèle de données (dont RLS Supabase).

---

## 1. Parcours utilisateur (vue d’ensemble)

1. **Arrivée** → connexion ou création de compte.  
2. **Première connexion** → complétion obligatoire du profil (onboarding).  
3. **Accès à l’app** → barre d’onglets : **Focus** (chronomètre), **Tâches**, **Groupes**, **Statistiques** (tableau de bord / agrégats), **Profil**. Écrans hors barre (navigation contextuelle) : **classement** d’un groupe, **groupe en direct** (qui étudie), **calendrier des stats**.  
4. **Session d’étude** → choix matière (et optionnellement tâche) → démarrage du chrono → arrêt → enregistrement d’une ligne `study_sessions`.

---

## 2. Authentification et accès à l’application

### US-A1 — Créer un compte
**En tant qu’** utilisateur non connecté,  
**je veux** m’inscrire avec e-mail / mot de passe ou un fournisseur OAuth (ex. Google, Apple sur iOS),  
**afin de** disposer d’un compte Tymii.

**Règles de gestion**

- L’e-mail et le mot de passe sont obligatoires pour l’inscription classique ; l’acceptation des conditions est requise côté écran d’inscription.
- Si l’inscription ne fournit pas immédiatement de session active, l’utilisateur est orienté vers la **vérification d’e-mail** avant d’aller plus loin.
- Si une session est disponible tout de suite, l’utilisateur est orienté vers le **complément de profil** (`fill-profile`).

### US-A2 — Me connecter
**En tant qu’** utilisateur existant,  
**je veux** me connecter (e-mail / mot de passe ou OAuth),  
**afin d’** accéder à mon espace.

**Règles de gestion**

- Sans utilisateur authentifié, la navigation renvoie vers l’écran de **connexion**.
- Après connexion réussie, l’utilisateur arrive sur l’app (racine `/`), sauf si l’onboarding profil n’est pas terminé (voir ci‑dessous).

### US-A3 — Compléter mon profil (onboarding)
**En tant qu’** utilisateur nouvellement inscrit (ou sans onboarding terminé),  
**je veux** renseigner pseudo, parcours scolaire (catégorie, année, spécialités le cas échéant),  
**afin de** finaliser mon compte et recevoir les **matières par défaut** adaptées à mon parcours.

**Règles de gestion**

- Tant que `onboarding_completed` n’est pas vrai côté profil, l’app **redirige** vers `fill-profile` (sauf si l’utilisateur est déjà sur cet écran).
- Contraintes métier sur l’écran : pseudo minimal, catégorie obligatoire, année valide, nombre de spécialités conforme au niveau (ex. lycée).
- À la fin : upsert du profil, mise à jour des métadonnées auth, **création / liaison des matières** à partir du catalogue (`ensureDefaultSubjectsFromKeys`), puis entrée dans l’app (`/`).

---

## 3. Matières et tâches (préparation au timer)

### US-S1 — Voir mes matières
**En tant qu’** utilisateur connecté ayant terminé l’onboarding,  
**je veux** voir la liste des matières liées à mon compte,  
**afin de** choisir sur quoi je travaille.

**Règles de gestion**

- Les matières affichées pour le suivi proviennent de la liaison **`user_subjects`** : matières non masquées (`is_hidden = false`), sujets non supprimés (`subjects.deleted_at` nul).
- Les enregistrements **`user_subjects`** sont limités par RLS au **`user_id`** de l’utilisateur connecté (lecture / écriture sur ses propres lignes).
- Les entrées **catalogue** (sujets globaux sans propriétaire) peuvent être **matérialisées en lignes `subjects` personnelles** (`owner_id` = utilisateur) pour permettre renommage / couleur sans impacter les autres comptes ; l’usage timer et les listes restent cohérents via **`user_subjects`** (voir migration `20260423100000_ypt_detach_global_subjects_per_user.sql` si déployée).

### US-S2 — Créer ou masquer une matière personnelle
**En tant qu’** utilisateur,  
**je veux** ajouter une matière personnalisée ou retirer une matière de ma liste,  
**afin d’** adapter mon planning.

**Règles de gestion**

- **Création** d’une ligne dans `subjects` : politique d’insertion — le créateur doit être **`owner_id`** (matière personnelle).
- **Mise à jour / suppression** des sujets : réservées au **propriétaire** (`owner_id` = utilisateur).
- Le catalogue global peut être lisible selon les politiques en base ; en revanche, **ce que l’utilisateur utilise pour timer** est piloté par **ses** `user_subjects` visibles dans l’UI.

### US-T1 — Gérer mes tâches
**En tant qu’** utilisateur,  
**je veux** créer des tâches rattachées à mes matières,  
**afin de** optionnellement lier une session à une tâche.

**Règles de gestion**

- Les tâches portent un **`user_id`** ; les politiques RLS limitent lecture / écriture aux **tâches de l’utilisateur connecté**.
- Lors d’un arrêt de session avec **`task_id`**, le temps est ajouté à la tâche (RPC `increment_task_seconds` ou repli par mise à jour contrôlée avec filtre `user_id`).

### Précisions — Soft delete (matières et tâches)

**Matières (`subjects`)**

- Une « suppression » de matière côté app est en général un **soft delete** : la ligne reste en base mais **`deleted_at`** passe à un horodatage (au lieu d’un `DELETE` physique).
- **Intérêt métier** : conserver l’**historique** (`study_sessions`, `tasks`, `user_subjects`) sans lignes orphelines ; permettre une **restauration** (`deleted_at` remis à `NULL`) si le produit l’expose.
- **Effet visible** : les requêtes qui alimentent le timer et les listes filtrent **`deleted_at IS NULL`** — une matière soft‑supprimée **n’apparaît plus** dans les matières actives.
- **Agrégations** : les vues de stats (ex. `session_subject_totals`) excluent les sujets supprimés pour ne pas mélanger ancien historique et sujets actifs dans les totaux par matière.
- **Suppression définitive** : une voie « hard delete » réservée aux sujets **sans aucune session** enregistrée peut exister côté code ; dès qu’il existe du temps sur la matière, la règle métier impose de rester sur le **soft delete**.

**Tâches (`tasks`)**

- Le schéma prévoit également **`deleted_at`** sur les tâches (même philosophie : archivage plutôt que disparition immédiate).
- Les politiques de lecture peuvent restreindre la vue aux tâches **actives** (`deleted_at` nul) ; une fonction de **nettoyage** peut supprimer définitivement les tâches soft‑supprimées au‑delà d’une durée (ex. 30 jours), selon ce qui est déployé et planifié côté base / cron.

---

## 4. Groupes sociaux

### US-G1 — Parcourir les groupes publics
**En tant qu’** utilisateur,  
**je veux** voir les groupes **publics** auxquels je ne participe pas encore,  
**afin de** rejoindre une communauté.

**Règles de gestion**

- La requête « groupes publics » filtre **`visibility = 'public'`** et exclut ceux dont je suis déjà membre approuvé.
- Un groupe **privé** n’apparaît pas dans cette liste de découverte.

### US-G2 — Rejoindre un groupe
**En tant qu’** utilisateur,  
**je veux** demander à rejoindre un groupe (éventuellement avec mot de passe si le groupe est protégé),  
**afin d’** y participer une fois accepté.

**Règles de gestion**

- La jointure passe par la RPC **`request_join_group`** (mot de passe optionnel selon configuration du groupe).
- Le statut de membre peut être **`approved`** ou en attente selon les règles du groupe (`requires_admin_approval`, etc.).
- Les **membres approuvés** d’un groupe privé peuvent **lire** le groupe et son contenu protégé par RLS ; un non‑membre (ou membre non approuvé selon politiques en vigueur) **ne doit pas** avoir la même visibilité sur les données du groupe privé.

### US-G3 — Voir « mes » groupes
**En tant qu’** utilisateur,  
**je veux** voir uniquement les groupes où je suis membre **`approved`**,  
**afin de** ne pas confondre invitation en attente et accès effectif.

**Règles de gestion**

- `fetchUserGroups` ne retourne que les adhésions avec **`status = 'approved'`**.

### US-G4 — Administrer un groupe
**En tant qu’** administrateur de groupe,  
**je veux** modifier les métadonnées du groupe ou gérer les membres,  
**afin de** modérer l’espace.

**Règles de gestion**

- Création de groupe : le **`created_by`** est l’utilisateur créateur.
- Mises à jour / suppressions : réservées aux **créateurs** ou **admins de groupe** approuvés, selon les politiques SQL déployées.

### US-G5 — Créer un groupe
**En tant qu’** utilisateur connecté,  
**je veux** créer un groupe (nom, visibilité, options mot de passe / approbation admin),  
**afin d’** inviter d’autres étudiants et suivre un classement collectif.

**Règles de gestion**

- **Insert** sur `groups` : le client envoie une ligne avec **`created_by` = utilisateur courant** ; la politique d’insertion exige cette égalité avec `auth.uid()`.
- **Lecture après création** (`RETURNING`, embed `groups` depuis `group_members`, etc.) : les politiques **SELECT** sur `groups` et `group_members` ne doivent pas s’appeler en boucle l’une l’autre via de simples sous-requêtes mutuelles (erreur Postgres `42P17`). Le dépôt prévoit une migration **`migrations/20260417120000_fix_groups_rls_infinite_recursion.sql`** : fonctions **`rls_*`** (`SECURITY DEFINER`, `search_path = public`) utilisées par les politiques pour préserver les mêmes règles métier sans cycle RLS.
- **Alternative serveur** : la RPC **`create_group_with_creator`** peut créer le groupe et la ligne membre admin en une transaction (voir `TECH_STACK.md` §3.6).

### US-G6 — Voir en direct qui étudie dans mon groupe
**En tant que** membre **approuvé** d’un groupe,  
**je veux** voir quels co‑membres ont le **chronomètre en cours** (état « en étude »),  
**afin de** me motiver et synchroniser mon rythme avec le groupe.

**Règles de gestion**

- Pendant une session, le client maintient une ligne dans **`user_study_presence`** (heartbeat ~45 s, effacement à l’arrêt du timer) via les requêtes dédiées côté app (`useStudyPresenceSync`).
- **RLS** : chaque utilisateur ne peut **insérer / mettre à jour / supprimer** que **sa** ligne (`user_id = auth.uid()`). La **lecture** est autorisée pour soi‑même **ou** pour tout utilisateur avec lequel on partage **au moins un groupe** en statut **`approved`** des deux côtés (fonction **`rls_users_share_approved_group`**, politique `presence_select_peers`).
- L’UI « groupe en direct » agrège membres + présence ; un pair est affiché « en ligne » sur le chrono seulement si la présence est **récente** (seuil côté app, ex. **2 min** via `STUDY_PRESENCE_STALE_MS`, indépendamment du heartbeat ~45 s).
- La visibilité des **profils** minimaux (pseudo, avatar) entre co‑membres de groupe privé repose sur les mêmes règles d’**appartenance approuvée** (politique `profiles` mise à jour dans la migration **`migrations/20260422150000_user_study_presence_group_peers.sql`**), ainsi que la lecture élargie de la **liste des membres** `group_members` pour les groupes non publics lorsque l’observateur est lui‑même membre approuvé.

---

## 5. Session d’étude (chronomètre)

### US-M1 — Lancer une session
**En tant qu’** utilisateur,  
**je veux** démarrer un chronomètre après avoir choisi une **matière** (parmi celles proposées dans mon contexte),  
**afin de** mesurer mon temps d’étude.

**Règles de gestion**

- Le démarrage n’est cohérent que si une **matière valide** est sélectionnée (présente dans la liste utilisée par l’écran timer).
- Si le **mode focus strict** est activé dans l’app : sur mobile, le démarrage peut exiger **autorisations** et, sur iOS, la **sélection d’applications** pour le mode concentration ; sur **web**, le mode focus n’est pas disponible de la même façon (`canStart` peut rester faux).

### US-M2 — Arrêter et enregistrer une session
**En tant qu’** utilisateur,  
**je veux** arrêter le chrono et enregistrer ma session,  
**afin de** voir mon temps comptabilisé sur la matière (et sur la tâche si j’en ai choisi une).

**Règles de gestion**

- **Authentification** : sans `user_id`, la session n’est pas persistée (`not_authenticated`).
- **Persistance** : insertion dans **`study_sessions`** avec `user_id`, `subject_id`, `started_at`, `ended_at`, `task_id` optionnel, `notes`.
- **Durée (calcul)** : `started_at` et `ended_at` sont dérivés du temps écoulé sur le chrono au moment du **Stop** ; la colonne **`duration_seconds`** est en base une valeur **générée** à partir de l’écart fin − début.

**Durée minimale et plafond**

- **Côté application** (`useTimer`) : si le chronomètre affiche **0 seconde** au moment de l’arrêt, la durée envoyée est **forcée à 1 seconde** (`Math.max(secondes, 1)`), afin d’éviter une session de longueur nulle tout en restant compatible avec les contraintes SQL.
- **Côté base** : une session doit avoir une durée **strictement positive** et **bornée** (typiquement **> 0** et **≤ 86 400 s** = 24 h par session), via contraintes sur `duration_seconds` / cohérence `ended_at` > `started_at`, plus un contrôle pour éviter des dates de fin trop loin dans le futur (tolérance d’environ une minute).
- **Effet utilisateur** : un clic « Stop » immédiat après « Start » enregistre tout de même **au moins 1 s** de session, pas une durée nulle.

- **RLS** : l’utilisateur ne peut **insérer / lire / modifier / supprimer** que des sessions dont il est le **`user_id`**.
- **Tâche liée** : si `task_id` est fourni, le temps est ajouté à **sa** tâche (cohérence avec `user_id` côté requêtes de repli).

### US-M3 — Concentration pendant la session
**En tant qu’** utilisateur en mode strict,  
**je veux** que la sortie du mode concentration soit détectée pendant une session,  
**afin d’** être informé que la reprise du chrono peut être conditionnée au retour du mode focus.

**Règles de gestion**

- À l’arrêt, si le mode focus était actif, l’app tente de **désactiver** le mode focus côté natif (hors web).
- Tant que le chrono tourne, l’état peut être **poussé** vers `user_study_presence` pour les pairs du groupe (voir **US-G6**).

### US-M4 — Feedback après session
**En tant qu’** utilisateur,  
**je veux** un retour immédiat (message avec minutes, objectif du jour le cas échéant),  
**afin de** comprendre ce qui a été enregistré.

**Règles de gestion**

- Après succès d’enregistrement, l’UI peut corréler la session aux **objectifs hebdomadaires / jour** et rafraîchir les **tâches**.

---

## 6. Synthèse des règles de gestion transverses

| Domaine | Règle |
|--------|--------|
| **Navigation** | Utilisateur non connecté → écran de connexion. Onboarding incomplet → `fill-profile`. |
| **Sessions** | Une ligne de session appartient toujours au **`user_id`** de l’utilisateur connecté (RLS). |
| **Matières (usage timer)** | L’interface ne propose le chronomètre que dans le cadre des **matières rattachées** à l’utilisateur via `user_subjects` (non masquées), avec sujets **`subjects`** typiquement **possédés** par l’utilisateur lorsque le modèle catalogue est détaché par compte. |
| **Tâches** | Un utilisateur ne manipule que **ses** tâches. |
| **Groupes publics / privés** | Découverte standard = groupes **publics** ; accès complet aux données d’un groupe **privé** = typiquement **membre approuvé** (et politiques RLS associées). |
| **RLS groupes / membres** | Pas de cycle de politiques entre `groups` et `group_members` : contrôles d’appartenance et de visibilité via fonctions **`rls_*`** déployées avec la migration `20260417120000_fix_groups_rls_infinite_recursion.sql`. |
| **Mot de passe / validation de groupe** | Géré côté serveur via RPC de demande d’adhésion. |
| **Intégrité temporelle** | Sessions avec fin après début, durée bornée, contrôle anti‑futur côté base. |
| **Soft delete** | Matières (et tâches) : `deleted_at` renseigné = archivé, exclu des listes actives ; historique préservé ; restauration possible pour les matières. |
| **Durée minimale de session** | App : minimum **1 s** si arrêt à 0 s ; base : durée **> 0** et **≤ 24 h** (valeurs typiques du schéma). |
| **Présence d’étude (groupes)** | Table **`user_study_presence`** : écriture **propriétaire** ; lecture **soi + pairs** approuvés dans un groupe commun ; heartbeat pendant le timer ; migration **`20260422150000_user_study_presence_group_peers.sql`**. |

---

## 7. Hors périmètre de ce document

- Détail des écrans (wording, composants).  
- Règles exactes de **gamification** (XP, streaks, triggers SQL) si elles évoluent indépendamment du flux timer.  
- Politiques RLS **versionnées** : se référer aux migrations Supabase en production pour le texte exact des politiques actives.

---

*Document généré pour cadrage produit / recette ; à tenir à jour lors des évolutions de parcours ou des RPC groupes / sessions. Mis à jour le 23 avril 2026 (navigation onglets, US-G6 présence groupe, matières catalogue par utilisateur, renvois migrations `20260422150000`, `20260423100000`).*
