export interface FolderCrumb {
  label: string;
  path: string;
}

export const ROOT_FOLDER_LABEL = "Dropbox";

function getSegments(path: string) {
  return path.split("/").filter(Boolean);
}

export function getParentPath(path: string): string {
  const segments = getSegments(path);
  return segments.length <= 1 ? "/" : `/${segments.slice(0, -1).join("/")}`;
}

export function getFolderName(path: string): string {
  return getSegments(path).at(-1) ?? ROOT_FOLDER_LABEL;
}

export function formatFolderPath(path: string): string {
  return getSegments(path).length === 0 ? `${ROOT_FOLDER_LABEL} (top level)` : path;
}

export function getBreadcrumbs(path: string): FolderCrumb[] {
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
