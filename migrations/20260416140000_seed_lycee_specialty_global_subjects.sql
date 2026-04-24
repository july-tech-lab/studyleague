-- Lycée spécialités (constants/pathSubjectOptions.ts → LYCEE_SPECIALTY_SUBJECT_KEYS).
-- Alignement avec constants/subjectCatalog.ts : ces bank_key manquaient des seeds
-- 20260414120000 et 20260416200000. Idempotent (NOT EXISTS sur bank_key actif).

INSERT INTO public.subjects (name, slug, icon, color, owner_id, bank_key, is_active)
SELECT v.name, v.bank_key, v.icon, v.color, NULL::uuid, v.bank_key, true
FROM (
  VALUES
    ('Digital & computer science (NSI)', 'nsi', 'code', '#0F766E'),
    ('History–geography, geopolitics & political science', 'hggsp', 'globe', '#9333EA'),
    ('Humanities, literature & philosophy', 'hlp', 'book-open', '#7C3AED'),
    ('Languages & literature — English (LLCE)', 'llce_english', 'languages', '#059669'),
    ('Visual arts', 'arts_plastiques', 'palette', '#E91E63'),
    ('Physical education, sports practices & culture', 'eps', 'dumbbell', '#16A34A'),
    ('Engineering sciences', 'si', 'wrench', '#B45309')
) AS v(name, bank_key, icon, color)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects s
  WHERE s.bank_key = v.bank_key
    AND s.deleted_at IS NULL
);
