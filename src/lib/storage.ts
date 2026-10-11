import { RECENT_SAVE_LIMIT } from "./constants";
import type {
  DropboxTokens,
  ExtensionSettings,
  ExtensionSettingsPatch,
  PendingSaveState,
  RecentSaveRecord,
  SaveResult,
} from "./types";

export const STORAGE_KEYS = {
  settings: "settings",
  tokens: "dropboxTokens",
  recentSaves: "recentSaves",
  pendingSave: "pendingSave",
  lastResult: "lastResult",
  saveWindowId: "saveWindowId",
};

const defaultSettings: ExtensionSettings = {
  appKey: null,
  lastUsedFolderPath: null,
  savePreferences: {
    saveMode: "reviewed",
    promptForRename: false,
    folderBehavior: "remember_last",
  },
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.settings,
  )) as Record<string, ExtensionSettings | undefined>;
  const stored: Partial<ExtensionSettings> = result[STORAGE_KEYS.settings] ?? {};
  return {
    ...defaultSettings,
    ...stored,
    savePreferences: {
      ...defaultSettings.savePreferences,
      ...(stored.savePreferences ?? {}),
    },
  };
}

export async function updateSettings(partial: ExtensionSettingsPatch): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next: ExtensionSettings = {
    ...current,
    ...partial,
    savePreferences: {
      ...current.savePreferences,
      ...(partial.savePreferences ?? {}),
    },
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

export async function getTokens(): Promise<DropboxTokens | null> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.tokens,
  )) as Record<string, DropboxTokens | null | undefined>;
  return result[STORAGE_KEYS.tokens] ?? null;
}

export async function setTokens(tokens: DropboxTokens | null): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.tokens]: tokens });
}

export async function getRecentSaves(): Promise<RecentSaveRecord[]> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.recentSaves,
  )) as Record<string, RecentSaveRecord[] | undefined>;
  return result[STORAGE_KEYS.recentSaves] ?? [];
}

export async function appendRecentSave(record: RecentSaveRecord): Promise<void> {
  const current = await getRecentSaves();
  const next = [record, ...current].slice(0, RECENT_SAVE_LIMIT);
  await chrome.storage.local.set({ [STORAGE_KEYS.recentSaves]: next });
}

export async function getPendingSave(): Promise<PendingSaveState | null> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.pendingSave,
  )) as Record<string, PendingSaveState | null | undefined>;
  return result[STORAGE_KEYS.pendingSave] ?? null;
}

export async function setPendingSave(pending: PendingSaveState | null): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.pendingSave]: pending });
}

// Session storage survives service worker restarts but not browser restarts, matching window lifetimes.
export async function getSaveWindowId(): Promise<number | null> {
  const result = (await chrome.storage.session.get(
    STORAGE_KEYS.saveWindowId,
  )) as Record<string, number | null | undefined>;
  return result[STORAGE_KEYS.saveWindowId] ?? null;
}

export async function setSaveWindowId(windowId: number | null): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.saveWindowId]: windowId });
}

export async function setLastResult(result: SaveResult | null): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.lastResult]: result });
}