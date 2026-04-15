import type { CategoryId } from "./categories";
import { CATEGORY_DEFINITIONS } from "./categories";
import type { SubjectKey } from "./subjectCatalog";

/** Year option per category (flat id for storage + i18n). */
export type AcademicYearId =
  | "primaire_cp"
  | "primaire_ce"
  | "primaire_cm"
  | "college_6e"
  | "college_5e"
  | "college_4e"
  | "college_3e"
  | "lycee_seconde"
  | "lycee_premiere"
  | "lycee_terminale"
  | "prepa_all"
  | "univ_l1"
  | "univ_l2"
  | "univ_l3_plus"
  | "autres_all";

export type YearOption = {
  id: AcademicYearId;
  /** i18n: onboarding.years.<labelKey> */
  labelKey: string;
};

const BASE_LYCEE: SubjectKey[] = CATEGORY_DEFINITIONS.find((c) => c.id === "lycee")!.subjects;

/** Seconde: tronc commun sans philo ni SES obligatoires au même titre que première */
const LYCEE_SECONDE_SUBJECTS: SubjectKey[] = [
  "french",
  "mathematics",
  "physics_chemistry",
  "biology",
  "history_geography",
  "english",
];

export const YEARS_BY_CATEGORY: Record<CategoryId, YearOption[]> = {
  primaire: [
    { id: "primaire_cp", labelKey: "cp" },
    { id: "primaire_ce", labelKey: "ce" },
    { id: "primaire_cm", labelKey: "cm" },
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
  prepa: [{ id: "prepa_all", labelKey: "prepa" }],
  universite: [
    { id: "univ_l1", labelKey: "l1" },
    { id: "univ_l2", labelKey: "l2" },
    { id: "univ_l3_plus", labelKey: "l3_plus" },
  ],
  autres: [{ id: "autres_all", labelKey: "all" }],
};

export function categoryNeedsYearStep(category: CategoryId): boolean {
  return YEARS_BY_CATEGORY[category].length > 1;
}

/** Spécialités: 3 en première, 2 en terminale (pas en seconde). */
export function yearNeedsSpecialties(
  category: CategoryId,
  yearId: AcademicYearId | null
): boolean {
  return (
    category === "lycee" &&
    (yearId === "lycee_premiere" || yearId === "lycee_terminale")
  );
}

export function requiredSpecialtyCount(
  yearId: AcademicYearId | null
): number {
  if (yearId === "lycee_premiere") return 3;
  if (yearId === "lycee_terminale") return 2;
  return 0;
}

function uniqueSubjectKeys(keys: SubjectKey[]): SubjectKey[] {
  return [...new Set(keys)];
}

/**
 * Subject keys to create after onboarding from path + specialties.
 */
export function getSubjectKeysForAcademicPath(
  category: CategoryId,
  yearId: AcademicYearId | null,
  specialtyKeys: SubjectKey[]
): SubjectKey[] {
  if (category === "lycee" && yearId === "lycee_seconde") {
    return uniqueSubjectKeys([...LYCEE_SECONDE_SUBJECTS]);
  }

  if (category === "lycee" && (yearId === "lycee_premiere" || yearId === "lycee_terminale")) {
    return uniqueSubjectKeys([...BASE_LYCEE, ...specialtyKeys]);
  }

  const def = CATEGORY_DEFINITIONS.find((c) => c.id === category);
  return uniqueSubjectKeys(def?.subjects ?? []);
}
