import { useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "dash-theme";

/**
 * Get the system's preferred color scheme
 */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Resolve theme mode to actual theme (handles "system" mode)
 */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

/**
 * Apply theme to the document
 */
export function applyTheme(mode: ThemeMode): void {
  const resolvedTheme = resolveTheme(mode);
  const root = document.documentElement;

  if (resolvedTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Store preference
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    console.warn("Failed to save theme preference to localStorage:", error);
  }
}

/**
 * Get stored theme preference from localStorage
 */
export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch (error) {
    console.warn("Failed to read theme preference from localStorage:", error);
  }
  return "system"; // Default to system preference
}

/**
 * Initialize theme on page load (call before React renders)
 */
export function initializeTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

/**
 * React hook for theme management
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(mode));

  // Update theme when mode changes
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    applyTheme(newMode);
    setResolvedTheme(resolveTheme(newMode));
  };

  // Listen to system theme changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const newResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newResolvedTheme);

      // Reapply theme to update DOM
      const root = document.documentElement;
      if (newResolvedTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [mode]);

  // Initialize theme on mount
  useEffect(() => {
    applyTheme(mode);
  }, []);

  return {
    mode,
    setMode,
    resolvedTheme,
    isSystem: mode === "system",
  };
}