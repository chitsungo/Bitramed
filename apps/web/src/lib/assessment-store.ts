import type { AssessmentDraft } from "@/lib/assessment-progress";

const DB_NAME = "bitramed-learner";
const DB_VERSION = 1;
const STORE_NAME = "assessment-drafts";
const ACTIVE_USER_KEY = "bitramed:learner-cache-user";

export type StoredAssessmentDraft = AssessmentDraft & {
  userId: string;
  kind: "quiz" | "past_paper";
  assessmentId: string;
  updatedAt: string;
};

function key(
  userId: string,
  kind: string,
  assessmentId: string,
  progressKey: string
) {
  return `${userId}:${kind}:${assessmentId}:${progressKey}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is unavailable."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Offline storage failed."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Offline storage failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Offline storage failed."));
  });
}

export async function saveLocalDraft(draft: StoredAssessmentDraft) {
  await withStore("readwrite", (store) =>
    store.put(
      draft,
      key(draft.userId, draft.kind, draft.assessmentId, draft.progressKey)
    )
  );
}

export async function readLocalDraft(
  userId: string,
  kind: "quiz" | "past_paper",
  assessmentId: string,
  progressKey: string
) {
  return withStore<StoredAssessmentDraft | undefined>("readonly", (store) =>
    store.get(key(userId, kind, assessmentId, progressKey))
  );
}

export async function deleteLocalDraft(
  userId: string,
  kind: "quiz" | "past_paper",
  assessmentId: string,
  progressKey: string
) {
  await withStore("readwrite", (store) =>
    store.delete(key(userId, kind, assessmentId, progressKey))
  );
}

export async function clearLocalLearnerData(userId: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(`${userId}:`)) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () =>
      reject(transaction.error || new Error("Offline storage failed."));
  });
}

export async function reconcileLocalLearnerIdentity(userId: string) {
  const previousUserId = localStorage.getItem(ACTIVE_USER_KEY);
  if (previousUserId && previousUserId !== userId) {
    await clearLocalLearnerData(previousUserId);
  }
  localStorage.setItem(ACTIVE_USER_KEY, userId);
}

export async function clearLocalLearnerSession(userId: string) {
  await clearLocalLearnerData(userId);
  if (localStorage.getItem(ACTIVE_USER_KEY) === userId) {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
}
