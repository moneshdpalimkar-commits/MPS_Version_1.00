/**
 * MPS Staff Portal — Service Worker
 * Handles: asset caching, offline fallback, Background Sync for attendance
 */

const CACHE_VERSION = "v3";
const CACHE_NAME = `mps-staff-portal-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Static assets to precache during install
const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// IndexedDB constants (must be duplicated — SW cannot import TS modules)
const IDB_NAME = "mps-offline-db";
const IDB_VERSION = 1;
const IDB_STORE = "attendance_queue";
const SYNC_API_URL = "/api/attendance-sync";

// ─── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clear old caches
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      // Purge expired IndexedDB records
      purgeExpiredQueueRecords(),
    ]).then(() => self.clients.claim())
  );
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET or cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Network-Only: API and auth routes (always need fresh data)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return; // Fall through to browser default
  }

  // Cache-First: Next.js immutable static assets (hashed filenames)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Network-First for navigation (page requests) with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Try cached version first, then offline fallback
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Stale-While-Revalidate for other same-origin resources
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});

// ─── BACKGROUND SYNC ────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "attendance-sync") {
    event.waitUntil(syncAttendanceQueue());
  }
});

// ─── PUSH NOTIFICATIONS (future-ready) ──────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "MPS Staff Portal", {
      body: data.body || "You have a new notification.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "mps-notification",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/staff/attendance")
  );
});

// ─── SYNC HELPERS ────────────────────────────────────────────────────────────

async function syncAttendanceQueue() {
  let processed = 0;
  let failed = 0;
  let expired = 0;

  try {
    // Notify clients that sync has started
    await broadcastToClients({ type: "SYNC_START" });

    const db = await openIDB();
    const records = await getAllPendingRecords(db);

    const now = Date.now();

    for (const record of records) {
      // 1. Check expiry first
      if (record.expiresAt <= now) {
        await deleteIDBRecord(db, record.id);
        expired++;
        continue;
      }

      // 2. Attempt to sync to server
      try {
        const response = await fetch(SYNC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${record.accessToken}`,
          },
          body: JSON.stringify({
            type: record.type,
            base64Image: record.base64Image,
            latitude: record.latitude,
            longitude: record.longitude,
            timestamp: record.timestamp,
            expiresAt: record.expiresAt,
          }),
        });

        const result = await response.json();

        if (response.status === 410 || result.expired) {
          // Server says expired — delete locally
          await deleteIDBRecord(db, record.id);
          expired++;
        } else if (result.success) {
          // Successfully synced — remove from queue
          await deleteIDBRecord(db, record.id);
          processed++;
        } else {
          // Server error — leave in queue for next sync
          failed++;
        }
      } catch {
        // Network error — leave in queue for next sync
        failed++;
      }
    }

    // Notify clients of completion
    await broadcastToClients({
      type: "SYNC_COMPLETE",
      processed,
      failed,
      expired,
    });
  } catch (err) {
    console.error("[SW] Attendance sync error:", err);
    await broadcastToClients({ type: "SYNC_COMPLETE", processed: 0, failed: 1, expired: 0 });
  }
}

function broadcastToClients(message) {
  return clients.matchAll({ includeUncontrolled: true, type: "window" }).then((allClients) => {
    for (const client of allClients) {
      client.postMessage(message);
    }
  });
}

// ─── INDEXED DB HELPERS (vanilla JS — no imports in SW) ─────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPendingRecords(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () =>
      resolve(req.result.filter((r) => r.status === "pending"));
    req.onerror = () => reject(req.error);
  });
}

function deleteIDBRecord(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function purgeExpiredQueueRecords() {
  return openIDB()
    .then((db) => getAllPendingRecords(db).then((records) => ({ db, records })))
    .then(({ db, records }) => {
      const now = Date.now();
      const expired = records.filter((r) => r.expiresAt <= now);
      return Promise.all(expired.map((r) => deleteIDBRecord(db, r.id)));
    })
    .catch(() => {}); // Silent failure on activate
}
