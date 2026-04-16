-- ============================================================
-- Audit données : table public.subjects (+ usages)
-- À exécuter dans le SQL Editor Supabase (rôle service / postgres).
-- Objectif : repérer doublons, orphelins, incohérences avant nettoyage.
-- ============================================================

-- -----------------------------------------------------------------
-- A. Vue d'ensemble
-- -----------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS actifs,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_supprimes,
  count(*) AS total_lignes,
  count(*) FILTER (WHERE owner_id IS NULL AND deleted_at IS NULL) AS globaux_actifs,
  count(*) FILTER (WHERE owner_id IS NOT NULL AND deleted_at IS NULL) AS perso_actifs
FROM public.subjects;

-- -----------------------------------------------------------------
-- B. Doublons de nom pour les sujets personnels (même propriétaire, casse ignorée)
--     (Index unique subjects_owner_name_unique si présent — sinon doublons possibles.)
-- -----------------------------------------------------------------
SELECT
  owner_id,
  lower(name) AS name_norm,
  count(*) AS nb,
  array_agg(id ORDER BY created_at) AS subject_ids
FROM public.subjects
WHERE deleted_at IS NULL
  AND owner_id IS NOT NULL
GROUP BY owner_id, lower(name)
HAVING count(*) > 1
ORDER BY nb DESC;

-- -----------------------------------------------------------------
-- C. Sujets globaux : même bank_key actif (ne devrait pas arriver)
-- -----------------------------------------------------------------
SELECT
  bank_key,
  count(*) AS nb,
  array_agg(id ORDER BY created_at) AS subject_ids,
  array_agg(name ORDER BY created_at) AS names
FROM public.subjects
WHERE owner_id IS NULL
  AND deleted_at IS NULL
  AND bank_key IS NOT NULL
GROUP BY bank_key
HAVING count(*) > 1;

-- -----------------------------------------------------------------
-- D. Sujets globaux : même nom (casse ignorée) — seeds / migrations multiples
-- -----------------------------------------------------------------
SELECT
  lower(name) AS name_norm,
  count(*) AS nb,
  array_agg(id ORDER BY created_at) AS subject_ids,
  array_agg(coalesce(bank_key, '(null)') ORDER BY created_at) AS bank_keys
FROM public.subjects
WHERE owner_id IS NULL
  AND deleted_at IS NULL
GROUP BY lower(name)
HAVING count(*) > 1;

-- -----------------------------------------------------------------
-- E. Sujets globaux sans bank_key (catalogue app = subjectCatalog.ts)
-- -----------------------------------------------------------------
SELECT id, name, slug, icon, color, created_at
FROM public.subjects
WHERE owner_id IS NULL
  AND deleted_at IS NULL
  AND bank_key IS NULL
ORDER BY name;

-- -----------------------------------------------------------------
-- F. parent_subject_id invalide, auto-référence, ou parent soft-supprimé
-- -----------------------------------------------------------------
SELECT c.id, c.name, c.owner_id, c.parent_subject_id, 'parent_manquant_ou_supprime' AS probleme
FROM public.subjects c
LEFT JOIN public.subjects p ON p.id = c.parent_subject_id
WHERE c.parent_subject_id IS NOT NULL
  AND (
    p.id IS NULL
    OR p.deleted_at IS NOT NULL
    OR c.id = c.parent_subject_id
  )
  AND c.deleted_at IS NULL;

-- -----------------------------------------------------------------
-- G. Enfant utilisateur dont le parent n'est ni global ni même owner
--     (Règle attendue : parent global OU parent perso du même user.)
-- -----------------------------------------------------------------
SELECT
  c.id AS child_id,
  c.name AS child_name,
  c.owner_id AS child_owner,
  p.id AS parent_id,
  p.name AS parent_name,
  p.owner_id AS parent_owner
FROM public.subjects c
JOIN public.subjects p ON p.id = c.parent_subject_id AND p.deleted_at IS NULL
WHERE c.deleted_at IS NULL
  AND c.owner_id IS NOT NULL
  AND p.owner_id IS NOT NULL
  AND p.owner_id IS DISTINCT FROM c.owner_id;

-- -----------------------------------------------------------------
-- H. Couleurs invalides (si contrainte NOT VALID ou données anciennes)
-- -----------------------------------------------------------------
SELECT id, name, owner_id, color
FROM public.subjects
WHERE color IS NOT NULL
  AND color !~* '^#[a-f0-9]{6}$';

-- -----------------------------------------------------------------
-- I. Sessions liées à un sujet soft-supprimé (données « orphelines » côté métier)
-- -----------------------------------------------------------------
SELECT
  s.id AS subject_id,
  s.name,
  s.deleted_at,
  count(ss.id) AS session_count
FROM public.subjects s
JOIN public.study_sessions ss ON ss.subject_id = s.id
WHERE s.deleted_at IS NOT NULL
GROUP BY s.id, s.name, s.deleted_at
ORDER BY session_count DESC;

-- -----------------------------------------------------------------
-- J. Tâches liées à un sujet soft-supprimé
-- -----------------------------------------------------------------
SELECT
  s.id AS subject_id,
  s.name,
  s.deleted_at,
  count(t.id) AS task_count
FROM public.subjects s
JOIN public.tasks t ON t.subject_id = s.id
WHERE s.deleted_at IS NOT NULL
GROUP BY s.id, s.name, s.deleted_at
ORDER BY task_count DESC;

-- -----------------------------------------------------------------
-- K. user_subjects pointant vers un sujet soft-supprimé
-- -----------------------------------------------------------------
SELECT
  us.user_id,
  us.subject_id,
  s.name,
  s.deleted_at
FROM public.user_subjects us
JOIN public.subjects s ON s.id = us.subject_id
WHERE s.deleted_at IS NOT NULL;

-- -----------------------------------------------------------------
-- L. subject_weekly_goals sur sujet supprimé (si table présente)
-- -----------------------------------------------------------------
SELECT g.user_id, g.subject_id, s.name, s.deleted_at
FROM public.subject_weekly_goals g
JOIN public.subjects s ON s.id = g.subject_id
WHERE s.deleted_at IS NOT NULL;

-- -----------------------------------------------------------------
-- M. Perso avec bank_key identique à un global actif (doublon catalogue vs copie)
-- -----------------------------------------------------------------
SELECT
  p.id AS perso_id,
  p.name AS perso_name,
  p.owner_id,
  p.bank_key,
  g.id AS global_id,
  g.name AS global_name
FROM public.subjects p
JOIN public.subjects g
  ON g.bank_key = p.bank_key
 AND g.owner_id IS NULL
 AND g.deleted_at IS NULL
WHERE p.owner_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND p.bank_key IS NOT NULL;

-- -----------------------------------------------------------------
-- N. is_active = false mais pas soft-delete (à clarifier métier)
-- -----------------------------------------------------------------
SELECT id, name, owner_id, is_active, deleted_at
FROM public.subjects
WHERE is_active = false
  AND deleted_at IS NULL
ORDER BY created_at DESC;
