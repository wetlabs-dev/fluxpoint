import { cn } from "@/lib/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-water/40",
        variant === "primary" && "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
        variant === "secondary" && "border border-border bg-card text-foreground hover:bg-muted/70",
        variant === "ghost" && "text-primary hover:bg-muted/70",
        className
      )}
      {...props}
    />
  );
}
