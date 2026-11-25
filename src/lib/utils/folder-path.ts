import type { StorageProviderId } from "../types";

export interface FolderCrumb {
  label: string;
  path: string;
}

export const ROOT_FOLDER_LABEL = "Dropbox";
export const GOOGLE_DRIVE_ROOT_LABEL = "My Drive";

function getSegments(path: string) {
  return path.split("/").filter(Boolean);
}

export function getParentPath(path: string): string {
  const segments = getSegments(path);
  return segments.length <= 1 ? "/" : `/${segments.slice(0, -1).join("/")}`;
}

export function getFolderName(path: string, provider: StorageProviderId = "dropbox"): string {
  if (provider === "google_drive") {
    return path === "root" || !path ? GOOGLE_DRIVE_ROOT_LABEL : path;
  }
  return getSegments(path).at(-1) ?? ROOT_FOLDER_LABEL;
}

export function formatFolderPath(path: string, provider: StorageProviderId = "dropbox"): string {
  if (provider === "google_drive") {
    if (!path || path === "root") return `${GOOGLE_DRIVE_ROOT_LABEL} (top level)`;
    return path;
  }
  return getSegments(path).length === 0 ? `${ROOT_FOLDER_LABEL} (top level)` : path;
}

export function getBreadcrumbs(
  path: string,
  provider: StorageProviderId = "dropbox",
  trail: FolderCrumb[] = [],
): FolderCrumb[] {
  if (provider === "google_drive") {
    return [
      { label: GOOGLE_DRIVE_ROOT_LABEL, path: "root" },
      ...trail.filter((crumb) => crumb.path !== "root"),
    ];
  }
  const segments = getSegments(path);
  return [
    { label: ROOT_FOLDER_LABEL, path: "/" },
    ...segments.map((label, index) => ({ label, path: `/${segments.slice(0, index + 1).join("/")}` })),
  ];
}

export function isSameFolder(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const normalize = (value: string) => `/${getSegments(value).join("/")}`.toLowerCase();
  return normalize(a) === normalize(b);
}
