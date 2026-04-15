import type { SubjectKey } from "@/constants/subjectCatalog";
import { SUBJECT_CATALOG } from "@/constants/subjectCatalog";
import {
  attachSubjectToUser,
  createAndAttachSubject,
  fetchSubjects,
  fetchUserSubjects,
  type Subject,
} from "@/utils/queries";

/**
 * Ensures catalog subjects for the given bank keys exist and are visible for the user.
 */
export async function ensureDefaultSubjectsFromKeys(
  userId: string,
  subjectKeys: SubjectKey[],
  t: (key: string) => string
): Promise<void> {
  const [availableSubjects, userSubjects] = await Promise.all([
    fetchSubjects(userId),
    fetchUserSubjects(userId),
  ]);

  const subjectsByBankKey = new Map<string, Subject>();
  availableSubjects.forEach((s) => {
    if (s.bank_key) subjectsByBankKey.set(s.bank_key, s);
  });

  const visibleIds = new Set(userSubjects.map((s) => s.id));

  for (const subjectKey of subjectKeys) {
    const catalogEntry = SUBJECT_CATALOG[subjectKey];
    if (!catalogEntry) continue;

    const existing = subjectsByBankKey.get(subjectKey);

    if (existing) {
      if (!visibleIds.has(existing.id)) {
        await attachSubjectToUser(userId, existing.id);
        visibleIds.add(existing.id);
      }
      continue;
    }

    const translatedName = t(`subjectCatalog.${subjectKey}`);
    const created = await createAndAttachSubject(userId, translatedName, {
      bankKey: subjectKey,
      color: catalogEntry.defaultColor,
      icon: catalogEntry.icon,
    });
    subjectsByBankKey.set(subjectKey, created);
    visibleIds.add(created.id);
  }
}
