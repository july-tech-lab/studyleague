-- ============================================
-- SUPABASE DATABASE AUDIT SCRIPT
-- Focus: public schema + security + integrity
-- ============================================

begin;

drop table if exists audit_results;

create temporary table audit_results (
  category text,
  severity text,
  check_name text,
  object_type text,
  object_name text,
  details text,
  recommendation text
);

-- ============================================
-- 1. TABLE INVENTORY
-- ============================================

insert into audit_results
select
  'schema',
  'info',
  'public tables inventory',
  'table',
  table_name,
  'Table exists in public schema',
  'Review table purpose and ownership'
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE';

-- ============================================
-- 2. TABLES WITHOUT PRIMARY KEY
-- ============================================

insert into audit_results
select
  'schema',
  'high',
  'table without primary key',
  'table',
  t.table_name,
  'No primary key found',
  'Add a primary key to ensure uniqueness and support safe replication/querying'
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = t.table_schema
      and tc.table_name = t.table_name
      and tc.constraint_type = 'PRIMARY KEY'
  );

-- ============================================
-- 3. TABLES WITHOUT RLS
-- ============================================

insert into audit_results
select
  'security',
  'high',
  'table without RLS',
  'table',
  tablename,
  'RLS is disabled',
  'Enable row level security unless this table is intentionally server-only'
from pg_tables
where schemaname = 'public'
  and rowsecurity = false;

-- ============================================
-- 4. RLS ENABLED BUT NO POLICIES
-- ============================================

insert into audit_results
select
  'security',
  'high',
  'RLS enabled but no policies',
  'table',
  t.tablename,
  'RLS is enabled but no policies were found',
  'Add explicit policies or disable RLS if truly not needed'
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname
 and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.rowsecurity = true
group by t.tablename
having count(p.policyname) = 0;

-- ============================================
-- 5. OVERLY BROAD TABLE GRANTS
-- ============================================

insert into audit_results
select
  'security',
  case
    when grantee = 'anon' then 'high'
    else 'medium'
  end,
  'broad table grant',
  'table grant',
  table_name,
  'Granted ' || privilege_type || ' to ' || grantee,
  'Confirm this is intentional; prefer RLS + least privilege'
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRIGGER', 'TRUNCATE', 'REFERENCES');

-- ============================================
-- 6. SECURITY DEFINER FUNCTIONS
-- ============================================

insert into audit_results
select
  'security',
  'high',
  'security definer function',
  'function',
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  'Function runs with elevated privileges',
  'Review carefully: validate auth checks, search_path, and least-privilege behavior'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true;

-- ============================================
-- 7. SECURITY DEFINER WITHOUT EXPLICIT search_path
-- ============================================

insert into audit_results
select
  'security',
  'critical',
  'security definer without explicit search_path',
  'function',
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  'SECURITY DEFINER function definition may not set search_path explicitly',
  'Set search_path explicitly, usually to public'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
  and pg_get_functiondef(p.oid) not ilike '%search_path%';

-- ============================================
-- 8. FUNCTIONS EXECUTABLE BY anon
-- ============================================

insert into audit_results
select
  'security',
  'high',
  'function executable by anon',
  'function grant',
  routine_name,
  'anon has EXECUTE privilege',
  'Confirm the function is safe for public access'
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee = 'anon'
  and privilege_type = 'EXECUTE';

-- ============================================
-- 9. INDEX INVENTORY
-- ============================================

insert into audit_results
select
  'performance',
  'info',
  'index inventory',
  'index',
  indexname,
  indexdef,
  'Review index usefulness and redundancy'
from pg_indexes
where schemaname = 'public';

-- ============================================
-- 10. UNUSED INDEXES
-- ============================================

insert into audit_results
select
  'performance',
  case
    when idx_scan = 0 then 'medium'
    else 'low'
  end,
  'low usage index',
  'index',
  indexrelname,
  'idx_scan=' || idx_scan || ', size=' || pg_size_pretty(pg_relation_size(indexrelid)),
  'Review whether this index is useful or removable'
from pg_stat_user_indexes
where schemaname = 'public'
order by idx_scan asc;

-- ============================================
-- 11. LARGE TABLES
-- ============================================

insert into audit_results
select
  'operations',
  'info',
  'large table',
  'table',
  relname,
  'Total size=' || pg_size_pretty(pg_total_relation_size(relid)),
  'Review growth, archival strategy, and indexing'
from pg_catalog.pg_statio_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc
limit 20;

-- ============================================
-- 12. TABLES WITH ESTIMATED HIGH ROW COUNTS
-- ============================================

insert into audit_results
select
  'operations',
  'info',
  'high row count',
  'table',
  relname,
  'Estimated rows=' || n_live_tup,
  'Validate vacuum/analyze cadence and query patterns'
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc
limit 20;

-- ============================================
-- 13. TRIGGER INVENTORY
-- ============================================

insert into audit_results
select
  'schema',
  'info',
  'trigger inventory',
  'trigger',
  trigger_name,
  event_object_table || ' [' || action_timing || ' ' || event_manipulation || ']',
  'Review trigger logic for hidden writes or performance cost'
from information_schema.triggers
where trigger_schema = 'public';

-- ============================================
-- 14. TABLES WITH updated_at BUT NO TRIGGER
-- ============================================

insert into audit_results
select
  'data quality',
  'medium',
  'updated_at without trigger',
  'table',
  t.table_name,
  'Table has updated_at column but no trigger found',
  'Consider a BEFORE UPDATE trigger to maintain updated_at automatically'
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and exists (
    select 1
    from information_schema.columns c
    where c.table_schema = t.table_schema
      and c.table_name = t.table_name
      and c.column_name = 'updated_at'
  )
  and not exists (
    select 1
    from information_schema.triggers tr
    where tr.event_object_schema = t.table_schema
      and tr.event_object_table = t.table_name
  );

-- ============================================
-- 15. FOREIGN KEY INVENTORY
-- ============================================

insert into audit_results
select
  'schema',
  'info',
  'foreign key inventory',
  'foreign key',
  tc.constraint_name,
  tc.table_name || '.' || kcu.column_name || ' -> ' || ccu.table_name || '.' || ccu.column_name,
  'Review cascading behavior and delete semantics'
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY';

-- ============================================
-- 16. ORPHAN CHECKS FOR KNOWN RELATIONSHIPS
-- App-specific checks inferred from your schema
-- ============================================

insert into audit_results
select
  'integrity',
  'high',
  'orphan tasks.user_id',
  'rowset',
  'public.tasks',
  'Rows in tasks with no matching profile: ' || count(*),
  'Fix orphaned rows or restore missing parent profile'
from public.tasks t
left join public.profiles p on p.id = t.user_id
where t.user_id is not null
  and p.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'orphan tasks.subject_id',
  'rowset',
  'public.tasks',
  'Rows in tasks with no matching subject: ' || count(*),
  'Fix orphaned subject references'
from public.tasks t
left join public.subjects s on s.id = t.subject_id
where t.subject_id is not null
  and s.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'orphan study_sessions.user_id',
  'rowset',
  'public.study_sessions',
  'Rows in study_sessions with no matching profile: ' || count(*),
  'Fix orphaned session rows'
from public.study_sessions ss
left join public.profiles p on p.id = ss.user_id
where ss.user_id is not null
  and p.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'orphan study_sessions.subject_id',
  'rowset',
  'public.study_sessions',
  'Rows in study_sessions with no matching subject: ' || count(*),
  'Fix orphaned subject references'
from public.study_sessions ss
left join public.subjects s on s.id = ss.subject_id
where ss.subject_id is not null
  and s.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'orphan group_members.user_id',
  'rowset',
  'public.group_members',
  'Rows in group_members with no matching profile: ' || count(*),
  'Fix orphaned membership rows'
from public.group_members gm
left join public.profiles p on p.id = gm.user_id
where gm.user_id is not null
  and p.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'orphan group_members.group_id',
  'rowset',
  'public.group_members',
  'Rows in group_members with no matching group: ' || count(*),
  'Fix orphaned membership rows'
from public.group_members gm
left join public.groups g on g.id = gm.group_id
where gm.group_id is not null
  and g.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'orphan user_subjects.user_id',
  'rowset',
  'public.user_subjects',
  'Rows in user_subjects with no matching profile: ' || count(*),
  'Fix orphaned rows'
from public.user_subjects us
left join public.profiles p on p.id = us.user_id
where us.user_id is not null
  and p.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'orphan user_subjects.subject_id',
  'rowset',
  'public.user_subjects',
  'Rows in user_subjects with no matching subject: ' || count(*),
  'Fix orphaned rows'
from public.user_subjects us
left join public.subjects s on s.id = us.subject_id
where us.subject_id is not null
  and s.id is null
having count(*) > 0;

-- ============================================
-- 17. DUPLICATE BUSINESS KEYS
-- ============================================

insert into audit_results
select
  'data quality',
  'high',
  'duplicate subject names per owner',
  'rowset',
  'public.subjects',
  'Duplicate (owner_id, lower(name)) groups found: ' || count(*),
  'Enforce uniqueness and clean duplicates'
from (
  select owner_id, lower(name), count(*) as c
  from public.subjects
  where name is not null
  group by owner_id, lower(name)
  having count(*) > 1
) d
having count(*) > 0;

insert into audit_results
select
  'data quality',
  'high',
  'duplicate group membership',
  'rowset',
  'public.group_members',
  'Duplicate (group_id, user_id) combinations found: ' || count(*),
  'Add unique constraint if missing and clean duplicates'
from (
  select group_id, user_id, count(*) as c
  from public.group_members
  group by group_id, user_id
  having count(*) > 1
) d
having count(*) > 0;

insert into audit_results
select
  'data quality',
  'high',
  'duplicate user_subjects pair',
  'rowset',
  'public.user_subjects',
  'Duplicate (user_id, subject_id) combinations found: ' || count(*),
  'Add unique constraint if missing and clean duplicates'
from (
  select user_id, subject_id, count(*) as c
  from public.user_subjects
  group by user_id, subject_id
  having count(*) > 1
) d
having count(*) > 0;

-- ============================================
-- 18. SOFT DELETE CONSISTENCY
-- ============================================

insert into audit_results
select
  'data quality',
  'medium',
  'soft delete mismatch',
  'rowset',
  'public.tasks',
  'Tasks marked deleted but still status=done/planned/in-progress: ' || count(*),
  'Review whether deleted rows should remain queryable or have a dedicated archival state'
from public.tasks
where deleted_at is not null
having count(*) > 0;

-- ============================================
-- 19. PROFILE / AUTH CONSISTENCY
-- ============================================

insert into audit_results
select
  'integrity',
  'high',
  'missing profile for auth user',
  'rowset',
  'auth.users -> public.profiles',
  'Auth users without profile: ' || count(*),
  'Check signup trigger and backfill missing profiles'
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
having count(*) > 0;

insert into audit_results
select
  'integrity',
  'high',
  'profile without auth user',
  'rowset',
  'public.profiles -> auth.users',
  'Profiles without auth user: ' || count(*),
  'Investigate inconsistent deletes or broken cascades'
from public.profiles p
left join auth.users au on au.id = p.id
where au.id is null
having count(*) > 0;

-- ============================================
-- 20. MATERIALIZED VIEW PRESENCE
-- ============================================

insert into audit_results
select
  'operations',
  'info',
  'materialized view inventory',
  'materialized view',
  matviewname,
  'Materialized view exists',
  'Confirm refresh strategy and index coverage'
from pg_matviews
where schemaname = 'public';

-- ============================================
-- 21. POLICY INVENTORY
-- ============================================

insert into audit_results
select
  'security',
  'info',
  'policy inventory',
  'policy',
  policyname,
  tablename || ' [' || cmd || ']',
  'Review policy scope and logic'
from pg_policies
where schemaname = 'public';

-- ============================================
-- 22. FINAL SUMMARY ROWS
-- ============================================

insert into audit_results
select
  'summary',
  severity,
  'count by severity',
  'summary',
  severity,
  count(*)::text,
  'Use this to prioritize remediation'
from audit_results
where category <> 'summary'
group by severity;

commit;

select *
from audit_results
order by
  case severity
    when 'critical' then 1
    when 'high' then 2
    when 'medium' then 3
    when 'low' then 4
    else 5
  end,
  category,
  check_name,
  object_name;