"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addToQueue,
  getQueueCount,
  purgeExpired,
  OFFLINE_TTL_MS,
} from "@/lib/idb";
import { checkInAction, checkOutAction } from "@/app/actions/attendance-actions";

export type AttendanceType = "checkin" | "checkout";

export interface OfflineAttendanceResult {
  success: boolean;
  offline?: boolean;
  queued?: boolean;
  error?: string;
  status?: string;
}

export function useOfflineAttendance() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const supabase = createClient();

  // Initialize online state and sync count on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    // Purge expired records on mount and refresh queue count
    purgeExpired().then(() => {
      getQueueCount().then(setQueuedCount);
    });

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger Background Sync when back online
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        navigator.serviceWorker.ready.then((reg) => {
          (reg as any).sync
            .register("attendance-sync")
            .catch((err: unknown) => console.warn("Sync registration failed:", err));
        });
      }
      // Refresh queue count
      getQueueCount().then(setQueuedCount);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen for SW postMessage sync complete events
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        setIsSyncing(false);
        getQueueCount().then(setQueuedCount);
      }
      if (event.data?.type === "SYNC_START") {
        setIsSyncing(true);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker?.addEventListener("message", handleSWMessage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, []);

  /**
   * Submit attendance — routes to online (Server Action) or offline (IndexedDB + BackgroundSync) path.
   */
  const submitAttendance = useCallback(
    async (
      type: AttendanceType,
      base64Image: string,
      coords: { latitude?: number; longitude?: number }
    ): Promise<OfflineAttendanceResult> => {
      // === ONLINE PATH: Direct Server Action ===
      if (isOnline) {
        const actionInput = {
          base64Image,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        const result =
          type === "checkin"
            ? await checkInAction(actionInput)
            : await checkOutAction(actionInput);

        return {
          success: result.success,
          error: result.error,
          status: (result as any).status,
          offline: false,
        };
      }

      // === OFFLINE PATH: IndexedDB + Background Sync ===
      try {
        // Get current session token for background sync auth
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          return {
            success: false,
            error: "No active session. Please log in before going offline.",
          };
        }

        // Load dynamic offline TTL from localStorage, default to 24
        let ttlHours = 24;
        try {
          const stored = localStorage.getItem("session_timeout_hours");
          if (stored) {
            ttlHours = Number(stored);
          }
        } catch (e) {
          console.warn("Failed to read session_timeout_hours from localStorage", e);
        }

        // Store in IndexedDB
        await addToQueue({
          type,
          base64Image,
          latitude: coords.latitude ?? null,
          longitude: coords.longitude ?? null,
          userId: session.user.id,
          accessToken: session.access_token,
        }, ttlHours);

        // Refresh queue count display
        const count = await getQueueCount();
        setQueuedCount(count);

        // Register Background Sync tag if supported
        if ("serviceWorker" in navigator && "SyncManager" in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await (reg as any).sync.register("attendance-sync");
          } catch {
            // Background Sync not available (iOS), will sync on next app open
          }
        }

        const expiresInHours = Math.round(OFFLINE_TTL_MS / (1000 * 60 * 60));

        return {
          success: true,
          offline: true,
          queued: true,
          status: `offline_queued`,
          error: undefined,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || "Failed to queue attendance offline.",
        };
      }
    },
    [isOnline, supabase]
  );

  return {
    isOnline,
    queuedCount,
    isSyncing,
    submitAttendance,
    refreshQueueCount: () => getQueueCount().then(setQueuedCount),
  };
}
