export type CategoryId =
  | "primaire"
  | "college"
  | "lycee"
  | "prepa"
  | "universite"
  | "autres";

/** Ordered list for onboarding / profile pickers (labels via i18n `categories.*`). */
export const CATEGORY_DEFINITIONS: { id: CategoryId }[] = [
  { id: "primaire" },
  { id: "college" },
  { id: "lycee" },
  { id: "prepa" },
  { id: "universite" },
  { id: "autres" },
];
