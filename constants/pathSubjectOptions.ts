import type { SubjectKey } from "./subjectCatalog";

/**
 * Options de parcours : langues vivantes (primaire, collège, lycée, prépa) et spécialités lycée.
 * Même `SubjectKey` que le catalogue / `bank_key` en base.
 */

/** Langues proposées (primaire, collège, lycée, prépa). */
export const LANGUAGE_OPTION_SUBJECT_KEYS: readonly SubjectKey[] = [
  "english",
  "spanish",
  "german",
  "italian",
  "chinese",
  "japanese",
  "latin",
  "greek",
];

/**
 * Spécialités proposées en Première / Terminale (choix facultatifs).
 */
export const LYCEE_SPECIALTY_SUBJECT_KEYS: readonly SubjectKey[] = [
  "mathematics",
  "physics_chemistry",
  "svt",
  "ses",
  "nsi",
  "hggsp",
  "hlp",
  "llce_english",
  "arts_plastiques",
  "eps",
  "si"
];

