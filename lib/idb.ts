/**
 * lib/idb.ts
 * Lightweight zero-dependency IndexedDB wrapper for offline attendance queue.
 * Used by the useOfflineAttendance hook to persist records while the device is offline.
 */

const DB_NAME = "mps-offline-db";
const DB_VERSION = 1;
const STORE_NAME = "attendance_queue";

export const OFFLINE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface AttendanceQueueRecord {
  id: string;
  type: "checkin" | "checkout";
  base64Image: string;
  latitude: number | null;
  longitude: number | null;
  userId: string;
  accessToken: string;
  timestamp: number;
  expiresAt: number;
  status: "pending" | "syncing";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Add a new attendance record to the offline queue. */
export async function addToQueue(
  record: Omit<AttendanceQueueRecord, "id" | "timestamp" | "expiresAt" | "status">,
  ttlHours?: number
): Promise<string> {
  const db = await openDB();
  const now = Date.now();
  const ttlMs = ttlHours ? ttlHours * 60 * 60 * 1000 : OFFLINE_TTL_MS;
  const full: AttendanceQueueRecord = {
    ...record,
    id: crypto.randomUUID(),
    timestamp: now,
    expiresAt: now + ttlMs,
    status: "pending",
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(full);
    req.onsuccess = () => resolve(full.id);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve all pending (non-expired) records from the queue. */
export async function getAllQueued(): Promise<AttendanceQueueRecord[]> {
  const db = await openDB();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = (req.result as AttendanceQueueRecord[]).filter(
        (r) => r.expiresAt > now && r.status === "pending"
      );
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Count all pending records (for badge display). */
export async function getQueueCount(): Promise<number> {
  const all = await getAllQueued();
  return all.length;
}

/** Delete a successfully synced record by ID. */
export async function deleteFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete all records from the queue (including synced ones). */
export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Purge all expired records (expiresAt < now). Called on app boot and SW activate. */
export async function purgeExpired(): Promise<number> {
  const db = await openDB();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const expired = (req.result as AttendanceQueueRecord[]).filter(
        (r) => r.expiresAt <= now
      );
      let deleted = 0;
      for (const record of expired) {
        store.delete(record.id);
        deleted++;
      }
      tx.oncomplete = () => resolve(deleted);
    };
    req.onerror = () => reject(req.error);
  });
}
