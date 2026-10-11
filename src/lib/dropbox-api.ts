import {
  CHUNK_SIZE,
  DROPBOX_API_BASE,
  DROPBOX_CONTENT_API_BASE,
  SAVE_URL_POLL_INTERVAL_MS,
  SAVE_URL_POLL_TIMEOUT_MS,
  SIMPLE_UPLOAD_LIMIT,
} from "./constants";
import { getValidAccessToken, setAccountEmail } from "./dropbox-auth";
import type { FolderEntry } from "./types";

async function dropboxApiFetch<T>(
  endpoint: string,
  init: RequestInit,
  apiBase = DROPBOX_API_BASE,
): Promise<T> {
  const token = await getValidAccessToken();
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Dropbox API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function getCurrentAccount(): Promise<{ email: string }> {
  const response = await dropboxApiFetch<{ email: string }>("/users/get_current_account", {
    method: "POST",
  });
  await setAccountEmail(response.email);
  return response;
}

export async function listFolders(path: string): Promise<FolderEntry[]> {
  const response = await dropboxApiFetch<{
    entries: Array<{
      ".tag": string;
      id: string;
      name: string;
      path_lower: string;
      path_display: string;
    }>;
  }>("/files/list_folder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: path === "/" ? "" : path,
      recursive: false,
    }),
  });

  return response.entries
    .filter((entry) => entry[".tag"] === "folder")
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      pathLower: entry.path_lower,
      pathDisplay: entry.path_display,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function createFolder(parentPath: string, name: string): Promise<FolderEntry> {
  const fullPath =
    parentPath === "/" ? `/${name}` : `${parentPath.replace(/\/+$/, "")}/${name}`;
  const response = await dropboxApiFetch<{
    metadata: {
      id: string;
      name: string;
      path_lower: string;
      path_display: string;
    };
  }>("/files/create_folder_v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: fullPath,
      autorename: false,
    }),
  });

  return {
    id: response.metadata.id,
    name: response.metadata.name,
    pathLower: response.metadata.path_lower,
    pathDisplay: response.metadata.path_display,
  };
}

export async function saveUrlToDropbox(path: string, url: string): Promise<{ pathDisplay: string }> {
  const start = await dropboxApiFetch<{ async_job_id: string }>("/files/save_url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, url }),
  });

  const deadline = Date.now() + SAVE_URL_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, SAVE_URL_POLL_INTERVAL_MS));
    const status = await dropboxApiFetch<
      | { ".tag": "in_progress" }
      | { ".tag": "complete"; path_display: string }
      | { ".tag": "failed" }
    >("/files/save_url/check_job_status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ async_job_id: start.async_job_id }),
    });

    if (status[".tag"] === "complete") {
      return { pathDisplay: status.path_display };
    }
    if (status[".tag"] === "failed") {
      throw new Error("Dropbox URL import failed.");
    }
  }

  throw new Error("Dropbox URL import timed out.");
}

async function uploadSimple(path: string, data: ArrayBuffer): Promise<{ pathDisplay: string }> {
  const token = await getValidAccessToken();
  const response = await fetch(`${DROPBOX_CONTENT_API_BASE}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "add",
        autorename: true,
        mute: false,
      }),
    },
    body: data,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  return { pathDisplay: payload.path_display };
}

async function uploadSession(path: string, data: ArrayBuffer): Promise<{ pathDisplay: string }> {
  const token = await getValidAccessToken();
  const bytes = new Uint8Array(data);
  const firstChunk = bytes.slice(0, CHUNK_SIZE);

  const startResponse = await fetch(`${DROPBOX_CONTENT_API_BASE}/files/upload_session/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ close: false }),
    },
    body: firstChunk,
  });

  if (!startResponse.ok) throw new Error(await startResponse.text());
  const startPayload = await startResponse.json();
  const sessionId = startPayload.session_id as string;

  let offset = firstChunk.byteLength;
  while (offset < bytes.byteLength) {
    const isLast = offset + CHUNK_SIZE >= bytes.byteLength;
    const chunk = bytes.slice(offset, Math.min(offset + CHUNK_SIZE, bytes.byteLength));
    const endpoint = isLast
      ? `${DROPBOX_CONTENT_API_BASE}/files/upload_session/finish`
      : `${DROPBOX_CONTENT_API_BASE}/files/upload_session/append_v2`;
    const arg = isLast
      ? {
          cursor: { session_id: sessionId, offset },
          commit: { path, mode: "add", autorename: true, mute: false },
        }
      : {
          cursor: { session_id: sessionId, offset },
          close: false,
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify(arg),
      },
      body: chunk,
    });

    if (!response.ok) throw new Error(await response.text());
    if (isLast) {
      const payload = await response.json();
      return { pathDisplay: payload.path_display };
    }
    offset += chunk.byteLength;
  }

  return uploadSimple(path, data);
}

export async function uploadFileToDropbox(
  path: string,
  data: ArrayBuffer,
): Promise<{ pathDisplay: string }> {
  if (data.byteLength <= SIMPLE_UPLOAD_LIMIT) {
    return uploadSimple(path, data);
  }
  return uploadSession(path, data);
}
