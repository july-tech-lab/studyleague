-- =============================================================================
-- Vérification qualité des données : public.subjects
-- À exécuter dans le SQL Editor Supabase (lecture seule).
-- S'appuie sur la structure documentée : subjects, user_subjects, tasks,
-- study_sessions, subject_weekly_goals (FK vers subjects).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Synthèse par type de sujet
-- -----------------------------------------------------------------------------
select
  count(*) filter (where deleted_at is null) as rows_not_deleted,
  count(*) filter (where deleted_at is not null) as rows_soft_deleted,
  count(*) filter (where owner_id is null and deleted_at is null) as global_active,
  count(*) filter (where owner_id is not null and deleted_at is null) as personal_active,
  count(*) filter (where is_active = false and deleted_at is null) as inactive_but_not_deleted
from public.subjects;

-- -----------------------------------------------------------------------------
-- 2) Slugs en double (même slug, plusieurs lignes) — souvent le cœur du nettoyage
-- -----------------------------------------------------------------------------
select
  slug,
  count(*) as row_count,
  count(*) filter (where owner_id is null) as global_rows,
  count(*) filter (where owner_id is not null) as personal_rows,
  array_agg(id order by created_at) as subject_ids,
  array_agg(name order by created_at) as names
from public.subjects
where slug is not null
  and deleted_at is null
group by slug
having count(*) > 1
order by count(*) desc, slug;

-- Détail des lignes pour chaque slug dupliqué
select s.*
from public.subjects s
join (
  select slug
  from public.subjects
  where slug is not null and deleted_at is null
  group by slug
  having count(*) > 1
) d on d.slug = s.slug
where s.deleted_at is null
order by s.slug, s.owner_id nulls first, s.created_at;

-- -----------------------------------------------------------------------------
-- 3) bank_key : doublons et manquants sur le catalogue global
-- -----------------------------------------------------------------------------
-- Doublons de bank_key (hors null)
select
  bank_key,
  count(*) as row_count,
  array_agg(id order by created_at) as subject_ids
from public.subjects
where bank_key is not null
  and deleted_at is null
group by bank_key
having count(*) > 1;

-- Sujets globaux sans bank_key (candidats backfill / alignement app)
select id, name, slug, is_active, created_at
from public.subjects
where owner_id is null
  and deleted_at is null
  and bank_key is null
order by name;

-- -----------------------------------------------------------------------------
-- 4) Incohérences slug vs bank_key (catalogue global uniquement)
-- -----------------------------------------------------------------------------
select id, name, slug, bank_key, is_active, created_at
from public.subjects
where owner_id is null
  and deleted_at is null
  and slug is not null
  and bank_key is not null
  and slug <> bank_key
order by slug;

-- -----------------------------------------------------------------------------
-- 5) (supprimé) parent_subject_id — colonne retirée (migration 20260416180000).
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 6) is_active vs deleted_at
-- -----------------------------------------------------------------------------
select id, name, owner_id, is_active, deleted_at
from public.subjects
where deleted_at is not null
  and is_active = true;

-- -----------------------------------------------------------------------------
-- 7) Doublons de nom pour un même propriétaire (déjà couvert partiellement par DB_AUDIT)
-- -----------------------------------------------------------------------------
select
  owner_id,
  lower(trim(name)) as name_norm,
  count(*) as c,
  array_agg(id order by created_at) as subject_ids
from public.subjects
where deleted_at is null
group by owner_id, lower(trim(name))
having count(*) > 1
order by c desc;

-- -----------------------------------------------------------------------------
-- 8) Impact avant fusion / suppression : références par subject_id
-- (exécuter pour un id précis ou utiliser la CTE ci-dessous pour les slugs dupliqués)
-- -----------------------------------------------------------------------------
with dup_slugs as (
  select slug
  from public.subjects
  where slug is not null and deleted_at is null
  group by slug
  having count(*) > 1
)
select
  s.id,
  s.slug,
  s.name,
  s.owner_id,
  s.bank_key,
  s.created_at,
  (select count(*) from public.user_subjects us where us.subject_id = s.id) as user_subjects_n,
  (select count(*) from public.tasks t where t.subject_id = s.id) as tasks_n,
  (select count(*) from public.study_sessions ss where ss.subject_id = s.id) as study_sessions_n,
  (select count(*) from public.subject_weekly_goals g where g.subject_id = s.id) as weekly_goals_n
from public.subjects s
join dup_slugs d on d.slug = s.slug
where s.deleted_at is null
order by s.slug, s.owner_id nulls first, s.created_at;

-- -----------------------------------------------------------------------------
-- 9) Sujets personnels sans slug (souvent OK, mais liste utile pour revue)
-- -----------------------------------------------------------------------------
select id, name, owner_id, bank_key, created_at
from public.subjects
where owner_id is not null
  and deleted_at is null
  and slug is null
order by created_at desc
limit 200;

-- -----------------------------------------------------------------------------
-- 10) Avant SUPPRESSION DURE (DELETE) d’un sujet : qui référence encore son id ?
--     Postgres refuse DELETE si une FK pointe encore vers subjects.id.
--     Tables connues : study_sessions, tasks, user_subjects, subject_weekly_goals.
--     Alternative : soft-delete (deleted_at) — la ligne reste, plus de conflit FK.
-- -----------------------------------------------------------------------------

-- Compteur par sujet (candidats “supprimables en dur” = toutes les colonnes à 0).
select
  s.id,
  s.name,
  s.slug,
  s.owner_id,
  (select count(*) from public.user_subjects us where us.subject_id = s.id) as user_subjects_n,
  (select count(*) from public.tasks t where t.subject_id is not null and t.subject_id = s.id) as tasks_n,
  (select count(*) from public.study_sessions ss where ss.subject_id is not null and ss.subject_id = s.id) as study_sessions_n,
  (select count(*) from public.subject_weekly_goals g where g.subject_id = s.id) as weekly_goals_n
from public.subjects s
where s.deleted_at is null
order by
  (select count(*) from public.study_sessions ss where ss.subject_id = s.id) desc,
  s.name;

-- Détail pour UN sujet (changer l’uuid dans le CTE `one`)
with one as (select '6d16e2e7-04b4-471c-aa19-f4a272312895'::uuid as subject_id)
select 'study_sessions' as ref_table, s.id, s.user_id, s.started_at
from public.study_sessions s
join one on s.subject_id = one.subject_id
union all
select 'tasks', t.id, t.user_id, null::timestamptz
from public.tasks t
join one on t.subject_id = one.subject_id
union all
select 'user_subjects', null::uuid, us.user_id, null::timestamptz
from public.user_subjects us
join one on us.subject_id = one.subject_id
union all
select 'subject_weekly_goals', g.id, g.user_id, null::timestamptz
from public.subject_weekly_goals g
join one on g.subject_id = one.subject_id;

-- -----------------------------------------------------------------------------
-- 11) Spécialités lycée (pathSubjectOptions) : bank_key attendu en global ?
--     Liste = LYCEE_SPECIALTY_SUBJECT_KEYS. Vide si migration 20260416140000 appliquée.
-- -----------------------------------------------------------------------------
select k.bank_key
from (
  values
    ('nsi'),
    ('hggsp'),
    ('hlp'),
    ('llce_english'),
    ('arts_plastiques'),
    ('eps'),
    ('si')
) as k(bank_key)
left join public.subjects s
  on s.bank_key = k.bank_key
 and s.owner_id is null
 and s.deleted_at is null
where s.id is null;
