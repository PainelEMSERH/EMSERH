
"use client";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
export default function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button aria-label="Alternar tema"
      className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm hover:shadow transition"
      onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <SunIcon /> : <MoonIcon />}<span className="hidden sm:inline">{isDark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
