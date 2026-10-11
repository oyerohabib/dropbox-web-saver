export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLikelyDirectAssetUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const pathname = new URL(value).pathname.toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp|mp4|webm|mov|m4v|avi|mp3|wav|ogg|pdf|zip|psd|ai|fig|sketch)$/i.test(
    pathname,
  );
}

export function getDomain(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "unknown";
  }
}
