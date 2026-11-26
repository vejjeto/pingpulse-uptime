"use client";

import { Moon, Sun } from "lucide-react";
import * as React from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Ignore storage access restriction
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar tema oscuro o claro"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 text-amber-400" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-indigo-500" />
      )}
      <span className="hidden sm:inline">{isDark ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
