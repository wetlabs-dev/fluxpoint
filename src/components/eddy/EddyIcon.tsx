import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function EddyIcon({ size = 20, className }: { size?: number; className?: string }) {
  return <Image src="/brand/eddy-icon.png" alt="" width={size} height={size} className={cn("shrink-0 object-contain", className)} aria-hidden="true" />;
}
