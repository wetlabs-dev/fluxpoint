export function mediaDeliveryUrl(url: string | null | undefined, version?: string | null) {
  if (!url) return "";
  if (!url.startsWith("/uploads/")) return url;
  const encodedPath = url.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const cacheKey = version ? `?v=${encodeURIComponent(version)}` : "";
  return `/api/media/file/${encodedPath}${cacheKey}`;
}

export function publicMediaDeliveryUrl(url: string | null | undefined, version?: string | null) {
  if (!url) return "";
  if (!url.startsWith("/uploads/")) return url;
  const encodedPath = url.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const cacheKey = version ? `?v=${encodeURIComponent(version)}` : "";
  return `/api/public/media/file/${encodedPath}${cacheKey}`;
}
