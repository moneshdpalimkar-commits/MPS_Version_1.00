"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[PWA] Service Worker registered, scope:", registration.scope);

          // Check for SW updates every 60 seconds
          setInterval(() => registration.update(), 60_000);
        })
        .catch((err) => {
          console.error("[PWA] Service Worker registration failed:", err);
        });

      // Listen for SW controller change (new version activated)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }, []);

  return null;
}
