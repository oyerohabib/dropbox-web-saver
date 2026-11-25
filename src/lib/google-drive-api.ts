import {
  CHUNK_SIZE,
  GOOGLE_DRIVE_API_BASE,
  GOOGLE_DRIVE_ROOT_FOLDER_KEY,
  GOOGLE_DRIVE_UPLOAD_API_BASE,
  SIMPLE_UPLOAD_LIMIT,
  googleDriveCanListExistingFolders,
} from "./constants";
import { getValidGoogleAccessToken } from "./google-drive-auth";
import { getGoogleDriveTokens, setGoogleDriveTokens, STORAGE_KEYS } from "./storage";
import type { FolderEntry, SaveErrorCode } from "./types";
import { SavePipelineError } from "./utils/errors";

function readErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? "";
  } catch {
    return body.slice(0, 200);
  }
}

export async function checkGoogleDriveResponse(
  response: Response,
  fallbackCode: SaveErrorCode = "UNKNOWN",
): Promise<void> {
  if (response.ok) return;

  if (response.status === 401) {
    await setGoogleDriveTokens(null);
    throw new SavePipelineError(
      "Your Google Drive connection expired or was revoked. Reconnect Google Drive to continue.",
      "TOKEN_EXPIRED",
    );
  }
  if (response.status === 429) {
    throw new SavePipelineError(
      "Google Drive is rate limiting requests. Wait a moment and try again.",
      fallbackCode,
    );
  }

  const message = readErrorMessage(await response.text().catch(() => ""));
  if (/not found|404/i.test(message) || response.status === 404) {
    throw new SavePipelineError(
      "That Google Drive folder no longer exists. Choose another folder.",
      "FOLDER_NOT_FOUND",
    );
  }
  if (/storageQuotaExceeded|insufficient/i.test(message)) {
    throw new SavePipelineError(
      "Your Google Drive is full. Free up space and try again.",
      "UPLOAD_FAILED",
    );
  }
  throw new SavePipelineError(
    `Google Drive request failed (${response.status})${message ? `: ${message}` : ""}`,
    fallbackCode,
  );
}

async function readFolderNameCache(): Promise<Record<string, string>> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.googleDriveFolderNames)) as Record<
    string,
    Record<string, string> | undefined
  >;
  return result[STORAGE_KEYS.googleDriveFolderNames] ?? {};
}

export async function rememberGoogleDriveFolderNames(
  entries: Array<{ id: string; name: string }>,
): Promise<void> {
  if (!entries.length) return;
  const current = await readFolderNameCache();
  let changed = false;
  for (const entry of entries) {
    const name = entry.name.trim();
    if (!entry.id || !name || current[entry.id] === name) continue;
    current[entry.id] = name;
    changed = true;
  }
  if (changed) {
    await chrome.storage.local.set({ [STORAGE_KEYS.googleDriveFolderNames]: current });
  }
}

export async function getGoogleDriveFolderName(folderKey: string): Promise<string> {
  if (!folderKey || folderKey === GOOGLE_DRIVE_ROOT_FOLDER_KEY) {
    return "My Drive (top level)";
  }

  const cached = (await readFolderNameCache())[folderKey];
  if (cached) return cached;

  try {
    const response = await driveApiFetch<{ name?: string }>(
      `/files/${encodeURIComponent(folderKey)}?${new URLSearchParams({
        fields: "name",
        supportsAllDrives: "true",
      }).toString()}`,
    );
    const name = response.name?.trim();
    if (name) {
      await rememberGoogleDriveFolderNames([{ id: folderKey, name }]);
      return name;
    }
  } catch {
    // Keep the folder id if Drive cannot resolve a name.
  }
  return folderKey;
}

async function driveApiFetch<T>(
  endpoint: string,
  init: RequestInit = {},
  apiBase = GOOGLE_DRIVE_API_BASE,
): Promise<T> {
  const token = await getValidGoogleAccessToken();
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  await checkGoogleDriveResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listGoogleDriveFolders(folderKey: string): Promise<FolderEntry[]> {
  const tokens = await getGoogleDriveTokens();
  if (!googleDriveCanListExistingFolders(tokens?.scope)) {
    throw new SavePipelineError(
      "Reconnect Google Drive to see folders already in your Drive. Disconnect, then connect again and allow access.",
      "AUTH_REQUIRED",
    );
  }

  const parent = folderKey || GOOGLE_DRIVE_ROOT_FOLDER_KEY;
  const query = [
    `'${parent.replace(/'/g, "\\'")}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,parents)",
    pageSize: "200",
    orderBy: "folder,name",
    spaces: "drive",
  });

  const response = await driveApiFetch<{
    files?: Array<{ id: string; name: string; parents?: string[] }>;
  }>(`/files?${params.toString()}`);

  const folders = (response.files ?? [])
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      pathLower: entry.id.toLowerCase(),
      pathDisplay: entry.name,
      parentKey: entry.parents?.[0] ?? parent,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  await rememberGoogleDriveFolderNames(folders);
  return folders;
}

export async function createGoogleDriveFolder(
  parentKey: string,
  name: string,
): Promise<FolderEntry> {
  const parent = parentKey || GOOGLE_DRIVE_ROOT_FOLDER_KEY;
  const response = await driveApiFetch<{
    id: string;
    name: string;
    parents?: string[];
  }>("/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent],
    }),
  });

  const created = {
    id: response.id,
    name: response.name,
    pathLower: response.id.toLowerCase(),
    pathDisplay: response.name,
    parentKey: response.parents?.[0] ?? parent,
  };
  await rememberGoogleDriveFolderNames([created]);
  return created;
}

async function uploadSimple(
  folderKey: string,
  filename: string,
  data: ArrayBuffer,
): Promise<{ pathDisplay: string; folderKey: string }> {
  const token = await getValidGoogleAccessToken();
  const parent = folderKey || GOOGLE_DRIVE_ROOT_FOLDER_KEY;
  const metadata = {
    name: filename,
    parents: [parent],
  };
  const boundary = `websaver-${crypto.randomUUID()}`;
  const metaPart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const fileHeader = `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;
  const metaBytes = new TextEncoder().encode(metaPart + fileHeader);
  const footerBytes = new TextEncoder().encode(footer);
  const body = new Uint8Array(metaBytes.byteLength + data.byteLength + footerBytes.byteLength);
  body.set(metaBytes, 0);
  body.set(new Uint8Array(data), metaBytes.byteLength);
  body.set(footerBytes, metaBytes.byteLength + data.byteLength);

  const response = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,parents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  await checkGoogleDriveResponse(response, "UPLOAD_FAILED");
  const payload = (await response.json()) as { id: string; name: string };
  return { pathDisplay: payload.name, folderKey: parent };
}

async function uploadResumable(
  folderKey: string,
  filename: string,
  data: ArrayBuffer,
): Promise<{ pathDisplay: string; folderKey: string }> {
  const token = await getValidGoogleAccessToken();
  const parent = folderKey || GOOGLE_DRIVE_ROOT_FOLDER_KEY;
  const startResponse = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_API_BASE}/files?uploadType=resumable&fields=id,name,parents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/octet-stream",
        "X-Upload-Content-Length": String(data.byteLength),
      },
      body: JSON.stringify({
        name: filename,
        parents: [parent],
      }),
    },
  );
  await checkGoogleDriveResponse(startResponse, "UPLOAD_FAILED");
  const uploadUrl = startResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new SavePipelineError("Google Drive did not return an upload URL.", "UPLOAD_FAILED");
  }

  const bytes = new Uint8Array(data);
  let offset = 0;
  while (offset < bytes.byteLength) {
    const end = Math.min(offset + CHUNK_SIZE, bytes.byteLength);
    const chunk = bytes.slice(offset, end);
    const isLast = end >= bytes.byteLength;
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${offset}-${end - 1}/${bytes.byteLength}`,
        "Content-Type": "application/octet-stream",
      },
      body: chunk,
    });

    if (isLast) {
      await checkGoogleDriveResponse(response, "UPLOAD_FAILED");
      const payload = (await response.json()) as { id: string; name: string };
      return { pathDisplay: payload.name, folderKey: parent };
    }

    if (response.status !== 308) {
      await checkGoogleDriveResponse(response, "UPLOAD_FAILED");
    }
    offset = end;
  }

  return uploadSimple(folderKey, filename, data);
}

export async function uploadFileToGoogleDrive(
  folderKey: string,
  filename: string,
  data: ArrayBuffer,
): Promise<{ pathDisplay: string; folderKey: string }> {
  if (data.byteLength <= SIMPLE_UPLOAD_LIMIT) {
    return uploadSimple(folderKey, filename, data);
  }
  return uploadResumable(folderKey, filename, data);
}

export function getGoogleDriveWebUrl(folderKey: string): string {
  const key = folderKey || GOOGLE_DRIVE_ROOT_FOLDER_KEY;
  if (key === GOOGLE_DRIVE_ROOT_FOLDER_KEY) {
    return "https://drive.google.com/drive/my-drive";
  }
  return `https://drive.google.com/drive/folders/${encodeURIComponent(key)}`;
}
