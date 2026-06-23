import { cn } from "@/lib/utils/cn";

export function FluxpointLogo({ size = 40, className, alt = "" }: { size?: number; className?: string; alt?: string }) {
  const source = size > 128 ? "/brand/fluxpoint-logo-512.png?v=20260623" : "/brand/fluxpoint-logo-256.png?v=20260623";
  return <img src={source} alt={alt} width={size} height={size} className={cn("shrink-0 object-contain", className)} aria-hidden={alt ? undefined : true} />;
}

export function FluxpointLogoTile({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <span style={{ width: size, height: size }} className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-white p-1 shadow-sm", className)}>
      <FluxpointLogo size={Math.max(16, size - 8)} />
    </span>
  );
}
