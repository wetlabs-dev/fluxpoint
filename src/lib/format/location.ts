export function buildLocationPath(location?: { name: string; parent?: any } | null): string {
  if (!location) return "Unplaced";
  const parts: string[] = [];
  let current: any = location;
  while (current) {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(" / ");
}
