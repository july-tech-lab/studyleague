import type { SubjectKey } from "./subjectCatalog";

export type CategoryId =
  | "primaire"
  | "college"
  | "lycee"
  | "prepa"
  | "universite"
  | "autres";

export type CategoryDefinition = {
  id: CategoryId;
  subjects: SubjectKey[];
};

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "primaire",
    subjects: [
      "reading",
      "writing",
      "mathematics",
      "science",
      "history",
      "geography",
      "art",
      "music",
    ],
  },
  {
    id: "college",
    subjects: [
      "french",
      "mathematics",
      "physics_chemistry",
      "biology",
      "history_geography",
      "technology",
      "english",
      "spanish",
      "german",
    ],
  },
  {
    id: "lycee",
    subjects: [
      "french",
      "mathematics",
      "physics_chemistry",
      "biology",
      "economics",
      "philosophy",
      "history_geography",
      "english",
      "spanish",
      "german",
    ],
  },
  {
    id: "prepa",
    subjects: [
      "analysis",
      "algebra",
      "physics",
      "chemistry",
      "computer_science",
      "engineering",
      "english",
      "french",
      "history_geography",
      "spanish",
      "german",
      "geopolitics",
      "economics",
      "sport",
    ],
  },
  {
    id: "universite",
    subjects: [
      "calculus",
      "algorithms",
      "data_structures",
      "economics",
      "biology",
      "chemistry",
      "physics",
      "marketing",
      "law",
    ],
  },
  {
    id: "autres",
    subjects: [
      "productivity",
      "languages",
      "music",
      "design",
      "marketing",
      "management",
      "health",
    ],
  },
];
