import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function EddyCharacter({ side, className, priority = false }: { side: "left" | "right"; className?: string; priority?: boolean }) {
  return <Image src={`/brand/eddy-${side}.png`} alt="Eddy, Fluxpoint's aquarium assistant" width={503} height={576} priority={priority} className={cn("h-auto w-full object-contain", className)} />;
}
