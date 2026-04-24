import type { SubjectKey } from "@/constants/subjectCatalog";
import { SUBJECT_CATALOG } from "@/constants/subjectCatalog";
import {
  attachSubjectToUser,
  createAndAttachSubject,
  fetchAllUserSubjects,
  type Subject,
} from "@/utils/queries";

async function loadBankSubjectsAndVisibleIds(userId: string) {
  const allLinkedSubjects = await fetchAllUserSubjects(userId);

  const subjectsByBankKey = new Map<string, Subject>();
  allLinkedSubjects.forEach((s) => {
    if (s.bank_key) subjectsByBankKey.set(s.bank_key, s);
  });

  const visibleIds = new Set(
    allLinkedSubjects.filter((s) => !s.is_hidden).map((s) => s.id)
  );
  return { subjectsByBankKey, visibleIds };
}

/**
 * Catalog keys for subjects that would be created or re-attached (not already visible).
 */
export async function listSubjectKeysToEnsure(
  userId: string,
  subjectKeys: SubjectKey[]
): Promise<SubjectKey[]> {
  const { subjectsByBankKey, visibleIds } = await loadBankSubjectsAndVisibleIds(
    userId
  );
  const keys: SubjectKey[] = [];

  for (const subjectKey of subjectKeys) {
    const catalogEntry = SUBJECT_CATALOG[subjectKey];
    if (!catalogEntry) continue;

    const existing = subjectsByBankKey.get(subjectKey);

    if (existing) {
      if (!visibleIds.has(existing.id)) {
        keys.push(subjectKey);
      }
      continue;
    }

    keys.push(subjectKey);
  }

  return keys;
}

/**
 * Ensures catalog subjects for the given bank keys exist and are visible for the user.
 */
export async function ensureDefaultSubjectsFromKeys(
  userId: string,
  subjectKeys: SubjectKey[],
  t: (key: string) => string
): Promise<void> {
  let { subjectsByBankKey, visibleIds } = await loadBankSubjectsAndVisibleIds(
    userId
  );

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
