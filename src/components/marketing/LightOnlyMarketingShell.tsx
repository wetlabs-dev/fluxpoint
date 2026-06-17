import { marketingThemeClassName, marketingThemeVars } from "@/lib/design/marketing-theme";

export function LightOnlyMarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={marketingThemeClassName}
      style={{
        colorScheme: "light",
        "--marketing-background": marketingThemeVars.background,
        "--marketing-foreground": marketingThemeVars.foreground,
        "--marketing-muted": marketingThemeVars.muted,
        "--marketing-card": marketingThemeVars.card,
        "--marketing-border": marketingThemeVars.border,
        "--marketing-primary": marketingThemeVars.primary,
        "--marketing-accent": marketingThemeVars.accent,
        "--marketing-sand": marketingThemeVars.sand,
        "--marketing-moss": marketingThemeVars.moss,
        "--marketing-navy": marketingThemeVars.navy
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
