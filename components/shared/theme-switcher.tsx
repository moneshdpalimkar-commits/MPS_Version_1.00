"use client";

import { useTheme } from "@/hooks/use-theme";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export function ThemeSwitcher() {
  const { setTheme, isDark, mounted } = useTheme();

  if (!mounted) {
    return <div className="w-9 h-9 rounded-md bg-muted/20 animate-pulse" />;
  }

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative w-9 h-9 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ scale: 0.5, rotate: -45, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: 45, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Moon className="h-[1.1rem] w-[1.1rem] text-foreground" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ scale: 0.5, rotate: 45, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: -45, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Sun className="h-[1.1rem] w-[1.1rem] text-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
