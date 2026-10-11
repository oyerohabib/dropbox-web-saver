import { getFileTypeForPath } from "./file-types";

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Host permission pattern covering a URL's origin, or null for non-web URLs. */
export function getOriginPattern(value: string): string | null {
  if (!isHttpUrl(value)) return null;
  const url = new URL(value);
  return `${url.protocol}//${url.hostname}/*`;
}

export function getPatternHost(pattern: string): string {
  return pattern.replace(/^https?:\/\//, "").replace(/\/\*$/, "");
}

export function isLikelyDirectAssetUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  return getFileTypeForPath(new URL(value).pathname) !== null;
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
