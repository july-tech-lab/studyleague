/******************************************************************************************
V4 — FINAL PRODUCTION DATABASE DOCUMENTATION GENERATOR
Structure optimisée avec toutes les améliorations

Covers EVERYTHING:
✔ Tables + Columns + Column Comments (combined for efficiency)
✔ Column Default Expressions (pg_attrdef - real expressions)
✔ Table Comments
✔ PK / FK / UQ / CHECK / EXCLUDE Constraints
✔ Indexes + Index Usage Statistics
✔ Sequences
✔ Views + Materialized Views
✔ Functions + Trigger Functions (full definitions)
✔ Triggers + Definitions (with multi-event support)
✔ Dependencies Between Objects (NEW!)
✔ Enums
✔ Roles + Permissions
✔ Table Privileges
✔ RLS Status + Policies (USING / WITH CHECK)
✔ Table Sizes + Table Statistics (NEW!)
✔ Security Labels (filtered)
✔ Tables Without Primary Keys
******************************************************************************************/

/***********************************
1. TABLES & COLUMNS (with comments)
***********************************/
SELECT 
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    pgd.description AS column_comment,
    CASE 
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PK'
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FK'
        WHEN tc.constraint_type = 'UNIQUE' THEN 'UQ'
        ELSE NULL
    END AS constraint_type
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
LEFT JOIN pg_catalog.pg_statio_all_tables st 
    ON st.relname = t.table_name
    AND st.schemaname = t.table_schema
LEFT JOIN pg_catalog.pg_description pgd 
    ON pgd.objoid = st.relid 
    AND pgd.objsubid = c.ordinal_position
    AND pgd.objsubid > 0
LEFT JOIN information_schema.key_column_usage kcu 
    ON kcu.table_schema = c.table_schema
    AND kcu.table_name = c.table_name 
    AND kcu.column_name = c.column_name
LEFT JOIN information_schema.table_constraints tc 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.constraint_schema = kcu.constraint_schema
WHERE 
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY 
    t.table_name, c.ordinal_position;

/***********************************
2. TABLE COMMENTS
***********************************/
SELECT
    c.relname AS table_name,
    obj_description(c.oid, 'pg_class') AS table_comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE 
    c.relkind = 'r'
    AND n.nspname = 'public'
ORDER BY c.relname;

/***********************************
3. COLUMN DEFAULT EXPRESSIONS (optimized)
***********************************/
SELECT 
    cls.relname AS table_name,
    att.attname AS column_name,
    pg_get_expr(def.adbin, def.adrelid) AS default_expression
FROM pg_attrdef def
JOIN pg_attribute att ON att.attrelid = def.adrelid AND att.attnum = def.adnum
JOIN pg_class cls ON cls.oid = def.adrelid
JOIN pg_namespace n ON n.oid = cls.relnamespace
WHERE 
    cls.relkind = 'r'
    AND n.nspname = 'public'
    AND att.attnum > 0
    AND NOT att.attisdropped
ORDER BY table_name, column_name;

/***********************************
4. FOREIGN KEYS
***********************************/
SELECT
    tc.table_name,
    kcu.column_name,
    'FK' AS constraint_type,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.constraint_schema
WHERE 
    tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

/***********************************
5. PRIMARY KEYS & UNIQUE CONSTRAINTS
***********************************/
SELECT
    tc.table_name,
    kcu.column_name,
    CASE 
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PK'
        WHEN tc.constraint_type = 'UNIQUE' THEN 'UQ'
        ELSE tc.constraint_type
    END AS constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE 
    tc.table_schema = 'public'
    AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
ORDER BY tc.table_name, tc.constraint_type, kcu.column_name;

/***********************************
6. CHECK + EXCLUDE CONSTRAINTS
***********************************/
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    CASE 
        WHEN contype = 'c' THEN 'CHECK'
        WHEN contype = 'x' THEN 'EXCLUDE'
        ELSE contype::text
    END AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype IN ('c', 'x')
    AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY table_name, constraint_name;

/***********************************
7. INDEXES
***********************************/
SELECT
    t.relname AS table_name,
    i.relname AS index_name,
    a.attname AS column_name,
    CASE 
        WHEN ix.indisprimary THEN 'PRIMARY'
        WHEN ix.indisunique THEN 'UNIQUE'
        ELSE 'NORMAL'
    END AS index_type,
    CASE 
        WHEN ix.indisunique THEN 'YES'
        ELSE 'NO'
    END AS is_unique
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a 
    ON a.attrelid = t.oid 
    AND a.attnum = ANY(ix.indkey)
WHERE 
    t.relkind = 'r'
    AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY t.relname, index_type DESC, i.relname, a.attname;

/***********************************
8. INDEX USAGE STATISTICS
***********************************/
SELECT 
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

/***********************************
9. SEQUENCES
***********************************/
SELECT
    sequence_schema,
    sequence_name,
    data_type,
    start_value,
    minimum_value,
    maximum_value,
    increment,
    cycle_option
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

/***********************************
10. VIEWS
***********************************/
SELECT
    table_schema,
    table_name,
    view_definition,
    is_updatable,
    is_insertable_into,
    is_trigger_updatable,
    is_trigger_deletable,
    is_trigger_insertable_into
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

/***********************************
11. MATERIALIZED VIEWS
***********************************/
SELECT 
    schemaname,
    matviewname AS view_name,
    pg_get_viewdef(matviewname::regclass, true) AS definition,
    hasindexes,
    ispopulated
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

/***********************************
12. FUNCTIONS (including full definitions)
***********************************/
SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    CASE 
        WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
        WHEN p.provolatile = 's' THEN 'STABLE'
        WHEN p.provolatile = 'v' THEN 'VOLATILE'
    END AS volatility,
    CASE 
        WHEN p.prosecdef THEN 'YES'
        ELSE 'NO'
    END AS security_definer,
    d.description AS description,
    pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
LEFT JOIN pg_description d ON p.oid = d.objoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE 
    n.nspname = 'public'
    AND p.proname NOT LIKE 'pg_%'
    AND p.proname NOT LIKE 'sql_%'
ORDER BY p.proname;

/***********************************
13. TRIGGER FUNCTIONS
***********************************/
SELECT 
    p.proname AS trigger_function,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE 
    t.tgisinternal = false
    AND n.nspname = 'public'
GROUP BY p.oid, p.proname
ORDER BY trigger_function;

/***********************************
14. TRIGGERS (with multi-event support)
***********************************/
SELECT
    t.tgname AS trigger_name,
    c.relname AS table_name,
    CASE 
        WHEN t.tgenabled = 'D' THEN 'DISABLED'
        WHEN t.tgenabled = 'O' THEN 'ENABLED'
        WHEN t.tgenabled = 'R' THEN 'REPLICA'
        WHEN t.tgenabled = 'A' THEN 'ALWAYS'
    END AS status,
    CASE 
        WHEN t.tgtype & 1 = 1 THEN 'BEFORE'
        ELSE 'AFTER'
    END AS timing,
    CASE 
        WHEN (t.tgtype & 2 = 2) AND (t.tgtype & 4 = 4) AND (t.tgtype & 8 = 8) THEN 'INSERT, DELETE, UPDATE'
        WHEN (t.tgtype & 2 = 2) AND (t.tgtype & 4 = 4) THEN 'INSERT, DELETE'
        WHEN (t.tgtype & 2 = 2) AND (t.tgtype & 8 = 8) THEN 'INSERT, UPDATE'
        WHEN (t.tgtype & 4 = 4) AND (t.tgtype & 8 = 8) THEN 'DELETE, UPDATE'
        WHEN t.tgtype & 2 = 2 THEN 'INSERT'
        WHEN t.tgtype & 4 = 4 THEN 'DELETE'
        WHEN t.tgtype & 8 = 8 THEN 'UPDATE'
        ELSE 'UNKNOWN'
    END AS event,
    CASE 
        WHEN t.tgtype & 16 = 16 THEN 'FOR EACH ROW'
        ELSE 'FOR EACH STATEMENT'
    END AS granularity,
    pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE 
    t.tgisinternal = false
    AND n.nspname = 'public'
ORDER BY c.relname, t.tgname;

/***********************************
15. DEPENDENCIES BETWEEN OBJECTS
***********************************/
SELECT 
    pg_depend.objid::regclass AS dependent_object,
    pg_depend.refobjid::regclass AS referenced_object,
    CASE 
        WHEN pg_depend.deptype = 'a' THEN 'AUTO'
        WHEN pg_depend.deptype = 'n' THEN 'NORMAL'
        WHEN pg_depend.deptype = 'i' THEN 'INTERNAL'
        WHEN pg_depend.deptype = 'p' THEN 'PIN'
        ELSE pg_depend.deptype
    END AS dependency_type
FROM pg_depend
WHERE pg_depend.objid IN (
    SELECT oid FROM pg_class 
    WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
)
AND pg_depend.refobjid IN (
    SELECT oid FROM pg_class 
    WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
)
ORDER BY dependent_object, referenced_object;

/***********************************
16. ENUMS
***********************************/
SELECT 
    n.nspname AS schema_name, 
    t.typname AS enum_name, 
    e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE 
    n.nspname = 'public'
ORDER BY enum_name, e.enumsortorder;

/***********************************
17. GLOBAL ROLES
***********************************/
SELECT 
    rolname,
    rolsuper,
    rolinherit,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin,
    rolreplication
FROM pg_roles
ORDER BY rolname;

/***********************************
18. TABLE PRIVILEGES
***********************************/
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY grantee, table_name, privilege_type;

/***********************************
19. RLS STATUS
***********************************/
SELECT 
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE 
    c.relkind = 'r'
    AND n.nspname = 'public'
ORDER BY c.relname;

/***********************************
20. RLS POLICIES (WITH USING / WITH CHECK)
***********************************/
SELECT 
    policyname AS policy_name,
    schemaname AS schema_name,
    tablename AS table_name,
    cmd AS command,
    roles,
    permissive,
    qual AS using_expression,
    with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY schemaname, tablename, cmd, policyname;

/***********************************
21. TABLE SIZES
***********************************/
SELECT 
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

/***********************************
22. TABLE STATISTICS (INSERT/UPDATE/DELETE/HOT)
***********************************/
SELECT
    relname AS table_name,
    n_tup_ins AS inserted,
    n_tup_upd AS updated,
    n_tup_del AS deleted,
    n_tup_hot_upd AS hot_updates,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

/***********************************
23. SECURITY LABELS (filtered)
***********************************/
SELECT 
    objoid::regclass AS object_name,
    provider,
    label
FROM pg_seclabel
WHERE objoid IN (
    SELECT oid FROM pg_class 
    WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
)
ORDER BY object_name;

/***********************************
24. TABLES WITHOUT PRIMARY KEYS
***********************************/
SELECT 
    tab.table_name
FROM information_schema.tables tab
LEFT JOIN information_schema.table_constraints tco 
    ON tab.table_schema = tco.table_schema 
    AND tab.table_name = tco.table_name 
    AND tco.constraint_type = 'PRIMARY KEY'
WHERE 
    tab.table_schema = 'public'
    AND tab.table_type = 'BASE TABLE'
    AND tco.constraint_name IS NULL
ORDER BY tab.table_name;
