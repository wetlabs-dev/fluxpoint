import { cn } from "@/lib/utils/cn";

export function EddyIcon({ size = 20, className, alt = "" }: { size?: number; className?: string; alt?: string }) {
  return <img src="/fluxpoint/brand/eddy-icon.png" alt={alt} width={size} height={size} className={cn("shrink-0 object-contain", className)} aria-hidden={alt ? undefined : true} />;
}
