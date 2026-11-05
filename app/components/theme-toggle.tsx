"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
type Theme = "light" | "dark" | "system";
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("bb-theme");
      } catch {}
      const value: Theme =
        stored === "light" || stored === "dark" ? stored : "system";
      setTheme(value);
      document.documentElement.dataset.theme =
        value === "system" ? (media.matches ? "dark" : "light") : value;
    };
    apply();
    media.addEventListener("change", apply);
    window.addEventListener("storage", apply);
    window.addEventListener("bb-theme", apply);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("storage", apply);
      window.removeEventListener("bb-theme", apply);
    };
  }, []);
  return (
    <div className="theme-switcher" role="group" aria-label="Өнгөний горим">
      {(
        [
          ["light", "Гэрэлтэй", Sun],
          ["dark", "Бараан", Moon],
          ["system", "Төхөөрөмжийн", Monitor],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          title={`${label} горим`}
          aria-label={`${label} горим`}
          aria-pressed={theme === value}
          onClick={() => {
            try {
              localStorage.setItem("bb-theme", value);
            } catch {}
            setTheme(value);
            document.documentElement.dataset.theme =
              value === "system"
                ? matchMedia("(prefers-color-scheme: dark)").matches
                  ? "dark"
                  : "light"
                : value;
            window.dispatchEvent(new Event("bb-theme"));
          }}
        >
          <Icon size={17} />
        </button>
      ))}
    </div>
  );
}
