import { cn } from "@/lib/utils/cn";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-10 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-water focus:ring-2 focus:ring-water/20",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-water focus:ring-2 focus:ring-water/20",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "min-h-10 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition focus:border-water focus:ring-2 focus:ring-water/20",
        props.className
      )}
    />
  );
}
