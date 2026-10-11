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

export function getDropboxWebUrl(folderPath: string): string {
  const segments = folderPath.split("/").filter(Boolean).map(encodeURIComponent);
  return ["https://www.dropbox.com/home", ...segments].join("/");
}

export function getDomain(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "unknown";
  }
}
