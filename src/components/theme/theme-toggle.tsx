"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { type ThemeMode, useTheme } from "@/components/theme/theme-provider";

const options: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor }
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/55 p-1" role="radiogroup" aria-label="Color theme">
      {options.map(({ value, label, Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex min-h-9 items-center justify-center gap-2 rounded px-2 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40",
              selected && "bg-card text-primary shadow-sm",
              compact && "px-1"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className={cn(compact && "sr-only")}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
