"use client";

import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const BANNER_DISMISSED_KEY = "mps-pwa-banner-dismissed";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Don't show if already dismissed recently
    const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed) return;

    // Detect if already running as standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS (Safari) — no beforeinstallprompt support
    const ua = window.navigator.userAgent;
    const iosDevice = /iphone|ipad|ipod/i.test(ua);
    const safariOnly = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    if (iosDevice && safariOnly) {
      setIsIOS(true);
      setTimeout(() => setIsVisible(true), 3000);
      return;
    }

    // Listen for the install prompt (Chrome / Edge / Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detect installed (appinstalled)
    const installedHandler = () => {
      setIsInstalled(true);
      setIsVisible(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsVisible(false);
    } else {
      setIsInstalling(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "1");
  };

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="relative rounded-2xl border border-indigo-500/30 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl shadow-indigo-900/40">
            {/* Glow accent */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600/10 to-purple-600/10 pointer-events-none" />

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
              aria-label="Dismiss install banner"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              {/* Icon */}
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Smartphone className="w-5 h-5 text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100 mb-0.5">
                  Install MPS Staff Portal
                </p>

                {isIOS ? (
                  <>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      Tap{" "}
                      <span className="inline-block px-1 py-0.5 bg-slate-700 rounded text-slate-300 font-mono text-[10px]">
                        Share ↑
                      </span>{" "}
                      then{" "}
                      <strong className="text-slate-200">Add to Home Screen</strong> for offline access.
                    </p>
                    <button
                      onClick={handleDismiss}
                      className="text-xs text-indigo-400 font-medium hover:text-indigo-300 transition-colors"
                    >
                      Got it
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      Get offline attendance, push alerts &amp; instant access — no app store needed.
                    </p>
                    <button
                      onClick={handleInstall}
                      disabled={isInstalling}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isInstalling ? "Installing…" : "Install App"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
