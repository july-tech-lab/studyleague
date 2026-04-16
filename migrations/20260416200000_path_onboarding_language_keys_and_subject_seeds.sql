-- Parcours collège/lycée : langues en profil + sujets globaux (catalogue national + LV it/zh/ja).
-- Idempotent : ADD COLUMN IF NOT EXISTS, INSERT … WHERE NOT EXISTS sur bank_key.

-- ── 1. Profil : clés de langues vivantes (comme specialty_keys) ─────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_keys text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.profiles.language_keys IS
  'Living-language subject catalog keys chosen at onboarding (e.g. english, spanish).';

-- ── 2. Sujets globaux (bank_key = constants/subjectCatalog.ts) ───────────

INSERT INTO public.subjects (name, slug, icon, color, owner_id, bank_key, is_active)
SELECT v.name, v.bank_key, v.icon, v.color, NULL::uuid, v.bank_key, true
FROM (
  VALUES
    ('Discovering the world', 'discover_world', 'globe', '#0D9488'),
    ('Life & Earth Sciences', 'svt', 'leaf', '#15803D'),
    ('Economics & social sciences', 'ses', 'trending-up', '#CA8A04'),
    ('Digital science & technology', 'snt', 'cpu', '#6366F1'),
    ('French & philosophy', 'french_philosophy', 'book-open', '#7C3AED'),
    ('Economics (ESH)', 'economics_esh', 'trending-up', '#0D9488'),
    ('History–geopolitics', 'geopolitics_hgg', 'globe', '#9333EA'),
    ('General knowledge', 'culture_general', 'brain', '#6D28D9'),
    ('Modern literature', 'modern_literature', 'book-open', '#B45309'),
    ('Latin', 'latin', 'landmark', '#A16207'),
    ('Ancient Greek', 'greek', 'landmark', '#854D0E'),
    ('Social sciences', 'social_sciences', 'users', '#4F46E5'),
    ('Italian', 'italian', 'languages', '#16A34A'),
    ('Chinese', 'chinese', 'languages', '#B91C1C'),
    ('Japanese', 'japanese', 'languages', '#DB2777')
) AS v(name, bank_key, icon, color)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects s
  WHERE s.bank_key = v.bank_key
    AND s.deleted_at IS NULL
);
