const CACHE_DB_NAME = "brm-ui-studio";
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = "workspace-cache";
const MAX_RECENT_WORKSPACES = 8;

export type CachedWorkspaceRecord = {
  id: string;
  handle: FileSystemDirectoryHandle | null;
  label: string;
  rootName: string;
  savedAt: number;
};

function openProjectCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }

    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open project cache."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.oncomplete = () => resolve();
  });
}

function normalizeCachedWorkspaceRecord(value: unknown): CachedWorkspaceRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<CachedWorkspaceRecord>;
  if (typeof record.label !== "string" || typeof record.rootName !== "string" || typeof record.savedAt !== "number") {
    return null;
  }
  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id : `workspace:${slugify(record.rootName || record.label)}`,
    handle: (record.handle ?? null) as FileSystemDirectoryHandle | null,
    label: record.label,
    rootName: record.rootName,
    savedAt: record.savedAt
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}

function sortCachedRecords(records: CachedWorkspaceRecord[]): CachedWorkspaceRecord[] {
  return [...records].sort((left, right) => right.savedAt - left.savedAt);
}

async function loadAllCachedWorkspaceRecords(): Promise<CachedWorkspaceRecord[]> {
  const db = await openProjectCacheDb();
  try {
    const transaction = db.transaction(CACHE_STORE_NAME, "readonly");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    const values = await waitForRequest(store.getAll());
    await waitForTransaction(transaction);
    return sortCachedRecords(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeCachedWorkspaceRecord(value))
        .filter((value): value is CachedWorkspaceRecord => Boolean(value))
    );
  } finally {
    db.close();
  }
}

async function resolveRecordId(
  existingRecords: CachedWorkspaceRecord[],
  handle: FileSystemDirectoryHandle,
  label: string
): Promise<string> {
  for (const record of existingRecords) {
    if (!record.handle || !handle.isSameEntry) continue;
    try {
      if (await handle.isSameEntry(record.handle)) {
        return record.id;
      }
    } catch {
      continue;
    }
  }

  const sameLabel = existingRecords.find(
    (record) => record.label.toLowerCase() === label.toLowerCase() && record.rootName.toLowerCase() === handle.name.toLowerCase()
  );
  if (sameLabel) return sameLabel.id;

  return `workspace:${Date.now()}:${slugify(handle.name || label)}`;
}

export async function loadCachedWorkspaceRecords(): Promise<CachedWorkspaceRecord[]> {
  return loadAllCachedWorkspaceRecords();
}

export async function loadCachedWorkspaceRecord(id?: string): Promise<CachedWorkspaceRecord | null> {
  const records = await loadAllCachedWorkspaceRecords();
  if (records.length <= 0) return null;
  if (!id) return records[0] ?? null;
  return records.find((record) => record.id === id) ?? null;
}

export async function saveCachedWorkspaceRecord(
  handle: FileSystemDirectoryHandle,
  label: string
): Promise<CachedWorkspaceRecord> {
  const existingRecords = await loadAllCachedWorkspaceRecords();
  const record: CachedWorkspaceRecord = {
    id: await resolveRecordId(existingRecords, handle, label),
    handle,
    label,
    rootName: handle.name || label,
    savedAt: Date.now()
  };

  const db = await openProjectCacheDb();
  try {
    const transaction = db.transaction(CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    store.put(record);

    const overflow = sortCachedRecords(
      [...existingRecords.filter((entry) => entry.id !== record.id), record]
    ).slice(MAX_RECENT_WORKSPACES);
    for (const staleRecord of overflow) {
      store.delete(staleRecord.id);
    }

    await waitForTransaction(transaction);
    return record;
  } finally {
    db.close();
  }
}

export async function removeCachedWorkspaceRecord(id: string): Promise<void> {
  const db = await openProjectCacheDb();
  try {
    const transaction = db.transaction(CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    store.delete(id);
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

export async function clearCachedWorkspaceRecord(): Promise<void> {
  const db = await openProjectCacheDb();
  try {
    const transaction = db.transaction(CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    store.clear();
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}
