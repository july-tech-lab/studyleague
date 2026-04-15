-- Seed global subjects for every app SubjectCatalog key (constants/subjectCatalog.ts).
-- Inserts one row per bank_key when no subject (any owner) already uses that bank_key.
-- Display names match i18n/en.json subjectCatalog.* fallbacks.

INSERT INTO public.subjects (name, slug, icon, color, owner_id, bank_key, is_active)
SELECT v.name, v.bank_key, v.icon, v.color, NULL::uuid, v.bank_key, true
FROM (
  VALUES
    ('Reading', 'reading', 'book-open', '#E91E63'),
    ('Writing', 'writing', 'pencil', '#8E24AA'),
    ('Mathematics', 'mathematics', 'calculator', '#4F46E5'),
    ('Science', 'science', 'flask-conical', '#00BCD4'),
    ('History', 'history', 'landmark', '#FF9800'),
    ('Geography', 'geography', 'globe', '#4CAF50'),
    ('Art', 'art', 'palette', '#E91E63'),
    ('Music', 'music', 'music', '#9C27B0'),
    ('French', 'french', 'book-open', '#DC2626'),
    ('Physics & Chemistry', 'physics_chemistry', 'atom', '#0891B2'),
    ('Biology', 'biology', 'leaf', '#16A34A'),
    ('History & Geography', 'history_geography', 'globe', '#D97706'),
    ('English', 'english', 'languages', '#059669'),
    ('Spanish', 'spanish', 'languages', '#EA580C'),
    ('Technology', 'technology', 'cpu', '#6366F1'),
    ('Economics', 'economics', 'trending-up', '#0D9488'),
    ('Philosophy', 'philosophy', 'brain', '#7C3AED'),
    ('Analysis', 'analysis', 'calculator', '#2563EB'),
    ('Algebra', 'algebra', 'calculator', '#4338CA'),
    ('Physics', 'physics', 'atom', '#0284C7'),
    ('Chemistry', 'chemistry', 'flask-conical', '#7C3AED'),
    ('Computer Science', 'computer_science', 'code', '#0F766E'),
    ('Engineering', 'engineering', 'wrench', '#B45309'),
    ('German', 'german', 'languages', '#DC2626'),
    ('Geopolitics', 'geopolitics', 'globe', '#9333EA'),
    ('Sport', 'sport', 'dumbbell', '#16A34A'),
    ('Calculus', 'calculus', 'calculator', '#1D4ED8'),
    ('Algorithms', 'algorithms', 'code', '#059669'),
    ('Data Structures', 'data_structures', 'database', '#7C3AED'),
    ('Marketing', 'marketing', 'megaphone', '#EA580C'),
    ('Law', 'law', 'scale', '#78716C'),
    ('Productivity', 'productivity', 'zap', '#F59E0B'),
    ('Languages', 'languages', 'languages', '#10B981'),
    ('Design', 'design', 'palette', '#EC4899'),
    ('Management', 'management', 'briefcase', '#6366F1'),
    ('Health', 'health', 'heart-pulse', '#EF4444')
) AS v(name, bank_key, icon, color)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects s
  WHERE s.bank_key = v.bank_key
    AND s.deleted_at IS NULL
);
