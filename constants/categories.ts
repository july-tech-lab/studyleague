export type CategoryId =
  | "primaire"
  | "college"
  | "lycee"
  | "prepa"
  | "universite"
  | "autres";

export type CategoryDefinition = {
  id: CategoryId;
  label: string;
  subjects: string[];
};

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "primaire",
    label: "Primaire",
    subjects: [
      "Lecture",
      "Écriture",
      "Mathématiques",
      "Sciences",
      "Histoire",
      "Géographie",
      "Arts plastiques",
      "Musique",
    ],
  },
  {
    id: "college",
    label: "Collège",
    subjects: [
      "Français",
      "Mathématiques",
      "Physique-Chimie",
      "SVT",
      "Histoire-Géo",
      "Anglais",
      "Espagnol",
      "Technologie",
    ],
  },
  {
    id: "lycee",
    label: "Lycée",
    subjects: [
      "Français",
      "Mathématiques",
      "Physique-Chimie",
      "SVT",
      "SES",
      "Philosophie",
      "Histoire-Géo",
      "Anglais",
    ],
  },
  {
    id: "prepa",
    label: "Classes Préparatoires",
    subjects: [
      "Analyse",
      "Algèbre",
      "Physique",
      "Chimie",
      "Informatique",
      "Sciences de l'ingénieur",
      "Anglais",
      "Français",
      "Histoire-Géo",
      "Anglais",
      "Espagnol",
      "Allemand",
      "HGGSP",
      "Economie",
      "Sport",
    ],
  },
  {
    id: "universite",
    label: "Université",
    subjects: [
      "Calculus",
      "Algorithms",
      "Data Structures",
      "Économie",
      "Biologie",
      "Chimie",
      "Physique",
      "Marketing",
      "Droit",
    ],
  },
  {
    id: "autres",
    label: "Autres",
    subjects: [
      "Productivité",
      "Langues",
      "Musique",
      "Design",
      "Marketing",
      "Management",
      "Santé",
    ],
  },
];

export const CATEGORY_LABELS: Record<CategoryId, string> =
  CATEGORY_DEFINITIONS.reduce((acc, item) => {
    acc[item.id] = item.label;
    return acc;
  }, {} as Record<CategoryId, string>);
