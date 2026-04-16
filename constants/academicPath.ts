import type { CategoryId } from "./categories";
import type { SubjectKey } from "./subjectCatalog";

/** Year option per category (flat id for storage + i18n). */
export type AcademicYearId =
  | "primaire_cp"
  | "primaire_ce1"
  | "primaire_ce2"
  | "primaire_cm1"
  | "primaire_cm2"
  | "college_6e"
  | "college_5e"
  | "college_4e"
  | "college_3e"
  | "lycee_seconde"
  | "lycee_premiere"
  | "lycee_terminale"
  | "prepa_mpsi_pcsi"
  | "prepa_bcpst"
  | "prepa_ecg"
  | "prepa_al_bl"
  | "univ_l1"
  | "univ_l2"
  | "univ_l3_plus"
  | "autres_all";

export type YearOption = {
  id: AcademicYearId;
  /** i18n: onboarding.years.<labelKey> */
  labelKey: string;
};

// ── Subject lists per academic year (single source of truth) ───────────────

/** Primaire : programme Questionner le monde / EMC, français, maths… (anglais / LV via `language_keys`). */
const PRIMAIRE_CP_CE1_SUBJECTS: SubjectKey[] = [
  "french",
  "mathematics",
  "discover_world",
  "art",
  "music",
  "sport",
];

/** Primaire : programme Questionner le monde / EMC, français, maths… (anglais / LV via `language_keys`). */
const PRIMAIRE_CE2_CM2_SUBJECTS: SubjectKey[] = [
  "french",
  "mathematics",
  "history_geography",
  "science",
  "art",
  "music",
  "sport",
];

/** Collège : SVT cycle 4, technologie… (LV via `language_keys` à l’étape dédiée). */
const COLLEGE_SUBJECTS: SubjectKey[] = [
  "french",
  "mathematics",
  "history_geography",
  "physics_chemistry",
  "svt",
  "technology",
  "art",
  "music",
  "sport",
];

/** Seconde : tronc commun (SNT, pas SES comme en 1re générale). LV à part. */
const LYCEE_SECONDE_SUBJECTS: SubjectKey[] = [
  "french",
  "mathematics",
  "history_geography",
  "physics_chemistry",
  "svt",
  "snt",
  "ses",
  "sport",
];

/** 1re / Term : tronc + SES, philo… (LV + spés via l’écran dédié). */
const LYCEE_TRONC_SUBJECTS: SubjectKey[] = [
  "french",
  "history_geography",
  "philosophy",
  "sport",
];

/** MPSI / PCSI / PTSI… : maths–physique–chimie–info + SI + français-philo (LV via `language_keys`). */
const PREPA_MPSI_PCSI_SUBJECTS: SubjectKey[] = [
  "mathematics",
  "physics",
  "chemistry",
  "computer_science",
  "engineering",
  "french_philosophy",
  "sport",
];

/** BCPST : bio–chimie–physique–maths + français-philo (LV via `language_keys`). */
const PREPA_BCPST_SUBJECTS: SubjectKey[] = [
  "biology",
  "chemistry",
  "physics",
  "mathematics",
  "french_philosophy",
  "computer_science",
  "sport",
];

/** ECG : maths, ESH, HGG, philo, culture générale (langues via `language_keys`). */
const PREPA_ECG_SUBJECTS: SubjectKey[] = [
  "mathematics",
  "economics_esh",
  "geopolitics_hgg",
  "philosophy",
  "culture_general",
];

/** Hypokhâgne / khâgne A/L & B/L (langues / LV2 / LCA via `language_keys`). */
const PREPA_AL_BL_SUBJECTS: SubjectKey[] = [
  "modern_literature",
  "philosophy",
  "history",
  "geography",
];

const UNIVERSITE_SUBJECTS: SubjectKey[] = [
  "economics",
  "social_sciences",
  "biology",
  "chemistry",
  "physics",
  "marketing",
  "law",
];

const AUTRES_SUBJECTS: SubjectKey[] = [
  "productivity",
  "languages",
  "music",
  "design",
  "marketing",
  "management",
  "health",
];

/**
 * Matières proposées / créées pour chaque `academic_year_key` (profil + onboarding).
 */
export const SUBJECT_KEYS_BY_ACADEMIC_YEAR: Record<
  AcademicYearId,
  readonly SubjectKey[]
> = {
  primaire_cp: PRIMAIRE_CP_CE1_SUBJECTS,
  primaire_ce1: PRIMAIRE_CP_CE1_SUBJECTS,
  primaire_ce2: PRIMAIRE_CE2_CM2_SUBJECTS,
  primaire_cm1: PRIMAIRE_CE2_CM2_SUBJECTS,
  primaire_cm2: PRIMAIRE_CE2_CM2_SUBJECTS,
  college_6e: COLLEGE_SUBJECTS,
  college_5e: COLLEGE_SUBJECTS,
  college_4e: COLLEGE_SUBJECTS,
  college_3e: COLLEGE_SUBJECTS,
  lycee_seconde: LYCEE_SECONDE_SUBJECTS,
  lycee_premiere: LYCEE_TRONC_SUBJECTS,
  lycee_terminale: LYCEE_TRONC_SUBJECTS,
  prepa_mpsi_pcsi: PREPA_MPSI_PCSI_SUBJECTS,
  prepa_bcpst: PREPA_BCPST_SUBJECTS,
  prepa_ecg: PREPA_ECG_SUBJECTS,
  prepa_al_bl: PREPA_AL_BL_SUBJECTS,
  univ_l1: UNIVERSITE_SUBJECTS,
  univ_l2: UNIVERSITE_SUBJECTS,
  univ_l3_plus: UNIVERSITE_SUBJECTS,
  autres_all: AUTRES_SUBJECTS,
};

/** Lycée 1re / Term : matières « principales » affichées hors spécialités. */
export const LYCEE_BASE_SUBJECT_KEYS: readonly SubjectKey[] = LYCEE_TRONC_SUBJECTS;

export const YEARS_BY_CATEGORY: Record<CategoryId, YearOption[]> = {
  primaire: [
    { id: "primaire_cp", labelKey: "cp" },
    { id: "primaire_ce1", labelKey: "ce1" },
    { id: "primaire_ce2", labelKey: "ce2" },
    { id: "primaire_cm1", labelKey: "cm1" },
    { id: "primaire_cm2", labelKey: "cm2" },
  ],
  college: [
    { id: "college_6e", labelKey: "sixieme" },
    { id: "college_5e", labelKey: "cinquieme" },
    { id: "college_4e", labelKey: "quatrieme" },
    { id: "college_3e", labelKey: "troisieme" },
  ],
  lycee: [
    { id: "lycee_seconde", labelKey: "seconde" },
    { id: "lycee_premiere", labelKey: "premiere" },
    { id: "lycee_terminale", labelKey: "terminale" },
  ],
  prepa: [
    { id: "prepa_mpsi_pcsi", labelKey: "prepa_mpsi_pcsi" },
    { id: "prepa_bcpst", labelKey: "prepa_bcpst" },
    { id: "prepa_ecg", labelKey: "prepa_ecg" },
    { id: "prepa_al_bl", labelKey: "prepa_al_bl" },
  ],
  universite: [
    { id: "univ_l1", labelKey: "l1" },
    { id: "univ_l2", labelKey: "l2" },
    { id: "univ_l3_plus", labelKey: "l3_plus" },
  ],
  autres: [{ id: "autres_all", labelKey: "all" }],
};

/** Deprecated DB values → current id (same primaire subjects). */
const LEGACY_ACADEMIC_YEAR_ID: Record<string, AcademicYearId> = {
  primaire_ce: "primaire_ce1",
  primaire_cm: "primaire_cm1",
  /** Ancien choix unique « prépa » → filière scientifique par défaut. */
  prepa_all: "prepa_mpsi_pcsi",
};

export function normalizeAcademicYearId(
  raw: string | null | undefined
): AcademicYearId | null {
  if (!raw) return null;
  const id = (LEGACY_ACADEMIC_YEAR_ID[raw] ?? raw) as AcademicYearId;
  for (const ys of Object.values(YEARS_BY_CATEGORY)) {
    if (ys.some((y) => y.id === id)) return id;
  }
  return null;
}

export function categoryNeedsYearStep(category: CategoryId): boolean {
  return YEARS_BY_CATEGORY[category].length > 1;
}

/** Affiche le bloc « spécialités » (1re / Term) — choix facultatifs, sans quota. */
export function yearNeedsSpecialties(
  category: CategoryId,
  yearId: AcademicYearId | null
): boolean {
  return (
    category === "lycee" &&
    (yearId === "lycee_premiere" || yearId === "lycee_terminale")
  );
}

/** Primaire, collège, lycée ou prépa : étape matières + options (langues ; spécialités au lycée). */
export function pathNeedsSubjectOptionsStep(category: CategoryId): boolean {
  return (
    category === "primaire" ||
    category === "college" ||
    category === "lycee" ||
    category === "prepa"
  );
}

function uniqueSubjectKeys(keys: SubjectKey[]): SubjectKey[] {
  return [...new Set(keys)];
}

function resolveYearIdForSubjects(
  category: CategoryId,
  yearId: AcademicYearId | null
): AcademicYearId | null {
  if (yearId) return yearId;
  const years = YEARS_BY_CATEGORY[category];
  return years.length === 1 ? years[0].id : null;
}

/**
 * Subject keys to create after onboarding from path + options.
 * Primaire / collège / lycée / prépa : ajoute `languageKeys`. Lycée 1re/Term : ajoute aussi `specialtyKeys`.
 */
export function getSubjectKeysForAcademicPath(
  category: CategoryId,
  yearId: AcademicYearId | null,
  specialtyKeys: SubjectKey[],
  languageKeys: SubjectKey[] = []
): SubjectKey[] {
  const resolved = resolveYearIdForSubjects(category, yearId);
  if (!resolved) return [];

  const base = [...SUBJECT_KEYS_BY_ACADEMIC_YEAR[resolved]];
  const lang =
    category === "primaire" ||
    category === "college" ||
    category === "lycee" ||
    category === "prepa"
      ? languageKeys
      : [];

  if (
    category === "lycee" &&
    (resolved === "lycee_premiere" || resolved === "lycee_terminale")
  ) {
    return uniqueSubjectKeys([...base, ...specialtyKeys, ...lang]);
  }

  if (
    category === "primaire" ||
    category === "college" ||
    category === "lycee" ||
    category === "prepa"
  ) {
    return uniqueSubjectKeys([...base, ...lang]);
  }

  return uniqueSubjectKeys(base);
}

export const ONBOARDING_DEFAULT_UNSELECTED_SUBJECT_KEYS: readonly SubjectKey[] = [
  "english",
  "spanish",
  "german",
  "italian",
  "chinese",
  "japanese",
];

/** Sous-ensemble du catalogue du parcours coché par défaut sur l’écran matières. */
export function getDefaultPickedSubjectKeysForPath(
  category: CategoryId,
  yearId: AcademicYearId | null,
  specialtyKeys: SubjectKey[],
  languageKeys: SubjectKey[] = []
): SubjectKey[] {
  const all = getSubjectKeysForAcademicPath(
    category,
    yearId,
    specialtyKeys,
    languageKeys
  );
  const omit = new Set<string>(ONBOARDING_DEFAULT_UNSELECTED_SUBJECT_KEYS);
  return all.filter((k) => !omit.has(k));
}
