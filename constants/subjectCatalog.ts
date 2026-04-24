export type SubjectKey =
  | "mathematics"
  | "science"
  | "french"
  | "physics_chemistry"
  | "biology"
  | "history_geography"
  | "english"
  | "spanish"
  | "technology"
  | "economics"
  | "philosophy"
  | "physics"
  | "chemistry"
  | "computer_science"
  | "engineering"
  | "german"
  | "italian"
  | "chinese"
  | "japanese"
  | "geopolitics"
  | "sport"
  | "calculus"
  | "algorithms"
  | "data_structures"
  | "art"
  | "music"
  | "history"
  | "geography"
  | "marketing"
  | "law"
  | "productivity"
  | "languages"
  | "design"
  | "management"
  | "health"
  | "discover_world"
  | "svt"
  | "ses"
  | "snt"
  | "french_philosophy"
  | "economics_esh"
  | "geopolitics_hgg"
  | "culture_general"
  | "modern_literature"
  | "latin"
  | "greek"
  | "social_sciences"
  | "nsi"
  | "hggsp"
  | "hlp"
  | "llce_english"
  | "arts_plastiques"
  | "eps"
  | "si";

export interface CatalogEntry {
  icon: string;
  defaultColor: string;
}

export const SUBJECT_CATALOG: Record<SubjectKey, CatalogEntry> = {
  mathematics:       { icon: "calculator",    defaultColor: "#4F46E5" },
  science:           { icon: "flask-conical", defaultColor: "#00BCD4" },
  french:            { icon: "book-open",     defaultColor: "#DC2626" },
  physics_chemistry: { icon: "atom",          defaultColor: "#0891B2" },
  biology:           { icon: "leaf",          defaultColor: "#16A34A" },
  history_geography: { icon: "globe",         defaultColor: "#D97706" },
  english:           { icon: "languages",     defaultColor: "#059669" },
  spanish:           { icon: "languages",     defaultColor: "#EA580C" },
  technology:        { icon: "cpu",           defaultColor: "#6366F1" },
  economics:         { icon: "trending-up",   defaultColor: "#0D9488" },
  philosophy:        { icon: "brain",         defaultColor: "#7C3AED" },
  physics:           { icon: "atom",          defaultColor: "#0284C7" },
  chemistry:         { icon: "flask-conical", defaultColor: "#7C3AED" },
  computer_science:  { icon: "code",          defaultColor: "#0F766E" },
  engineering:       { icon: "wrench",        defaultColor: "#B45309" },
  german:            { icon: "languages",     defaultColor: "#DC2626" },
  italian:           { icon: "languages",     defaultColor: "#16A34A" },
  chinese:           { icon: "languages",     defaultColor: "#B91C1C" },
  japanese:          { icon: "languages",     defaultColor: "#DB2777" },
  geopolitics:       { icon: "globe",         defaultColor: "#9333EA" },
  art:               { icon: "palette",       defaultColor: "#EC4899" },
  music:             { icon: "music",         defaultColor: "#DB2777" },
  history:           { icon: "landmark",      defaultColor: "#B45309" },
  geography:         { icon: "globe",         defaultColor: "#0D9488" },
  sport:             { icon: "dumbbell",      defaultColor: "#16A34A" },
  calculus:          { icon: "calculator",    defaultColor: "#1D4ED8" },
  algorithms:        { icon: "code",          defaultColor: "#059669" },
  data_structures:   { icon: "database",      defaultColor: "#7C3AED" },
  marketing:         { icon: "megaphone",     defaultColor: "#EA580C" },
  law:               { icon: "scale",         defaultColor: "#78716C" },
  productivity:      { icon: "zap",           defaultColor: "#F59E0B" },
  languages:         { icon: "languages",     defaultColor: "#10B981" },
  design:            { icon: "palette",       defaultColor: "#EC4899" },
  management:        { icon: "briefcase",     defaultColor: "#6366F1" },
  health:            { icon: "heart-pulse",   defaultColor: "#EF4444" },
  discover_world:    { icon: "globe",         defaultColor: "#0D9488" },
  svt:               { icon: "leaf",          defaultColor: "#15803D" },
  ses:               { icon: "trending-up",   defaultColor: "#CA8A04" },
  snt:               { icon: "cpu",           defaultColor: "#6366F1" },
  french_philosophy: { icon: "book-open",     defaultColor: "#7C3AED" },
  economics_esh:     { icon: "trending-up",   defaultColor: "#0D9488" },
  geopolitics_hgg:   { icon: "globe",         defaultColor: "#9333EA" },
  culture_general:   { icon: "brain",         defaultColor: "#6D28D9" },
  modern_literature: { icon: "book-open",     defaultColor: "#B45309" },
  latin:             { icon: "landmark",      defaultColor: "#A16207" },
  greek:             { icon: "landmark",      defaultColor: "#854D0E" },
  social_sciences:   { icon: "users",         defaultColor: "#4F46E5" },
  nsi:               { icon: "code",          defaultColor: "#0F766E" },
  hggsp:             { icon: "globe",         defaultColor: "#9333EA" },
  hlp:               { icon: "book-open",     defaultColor: "#7C3AED" },
  llce_english:      { icon: "languages",     defaultColor: "#059669" },
  arts_plastiques:   { icon: "palette",       defaultColor: "#E91E63" },
  eps:               { icon: "dumbbell",      defaultColor: "#16A34A" },
  si:                { icon: "wrench",        defaultColor: "#B45309" },
};

/**
 * Returns the translated display name for a subject.
 * If the subject has a bank_key matching the catalog, uses i18n.
 * Otherwise falls back to the raw DB name.
 */
export const getSubjectDisplayName = (
  subject: { name: string; bank_key?: string | null },
  t: (key: string) => string
): string => {
  if (subject.bank_key && subject.bank_key in SUBJECT_CATALOG) {
    const i18nKey = `subjectCatalog.${subject.bank_key}`;
    const translated = t(i18nKey);
    if (translated !== i18nKey) return translated;
  }
  return subject.name;
};