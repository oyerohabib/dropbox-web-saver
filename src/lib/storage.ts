import { RECENT_SAVE_LIMIT } from "./constants";
import type {
  DropboxTokens,
  ExtensionSettings,
  ExtensionSettingsPatch,
  GoogleDriveTokens,
  LastUsedFolders,
  PendingSaveState,
  RecentSaveRecord,
  SaveResult,
  SetupProgress,
  StorageProviderId,
} from "./types";

export const STORAGE_KEYS = {
  settings: "settings",
  tokens: "dropboxTokens",
  googleDriveTokens: "googleDriveTokens",
  googleDriveFolderNames: "googleDriveFolderNames",
  recentSaves: "recentSaves",
  pendingSave: "pendingSave",
  lastResult: "lastResult",
  saveWindowId: "saveWindowId",
  setupProgress: "setupProgress",
};

const defaultSetupProgress: SetupProgress = {
  createdApp: false,
  enabledScopes: false,
  addedRedirectUri: false,
};

const defaultLastUsedFolders: LastUsedFolders = {
  dropbox: null,
  google_drive: null,
};

const defaultSettings: ExtensionSettings = {
  appKey: null,
  lastUsedFolderPath: null,
  lastUsedFolders: { ...defaultLastUsedFolders },
  lastUsedFolderLabels: { ...defaultLastUsedFolders },
  lastUsedProvider: null,
  savePreferences: {
    saveMode: "reviewed",
    promptForRename: false,
    folderBehavior: "remember_last",
  },
  saveModeSetByUser: false,
  walkthroughHidden: false,
};

function normalizeLastUsedFolders(
  stored: Partial<ExtensionSettings> | undefined,
): LastUsedFolders {
  const fromMap = stored?.lastUsedFolders;
  const dropbox =
    fromMap?.dropbox
    ?? stored?.lastUsedFolderPath
    ?? null;
  return {
    dropbox,
    google_drive: fromMap?.google_drive ?? null,
  };
}

function normalizeLastUsedFolderLabels(
  stored: Partial<ExtensionSettings> | undefined,
): LastUsedFolders {
  const fromMap = stored?.lastUsedFolderLabels;
  return {
    dropbox: fromMap?.dropbox ?? stored?.lastUsedFolders?.dropbox ?? stored?.lastUsedFolderPath ?? null,
    google_drive: fromMap?.google_drive ?? null,
  };
}

export function migrateSettings(stored: Partial<ExtensionSettings> = {}): ExtensionSettings {
  const lastUsedFolders = normalizeLastUsedFolders(stored);
  const lastUsedFolderLabels = normalizeLastUsedFolderLabels(stored);
  return {
    ...defaultSettings,
    ...stored,
    lastUsedFolders,
    lastUsedFolderLabels,
    lastUsedProvider: stored.lastUsedProvider ?? null,
    lastUsedFolderPath: lastUsedFolders.dropbox,
    savePreferences: {
      ...defaultSettings.savePreferences,
      ...(stored.savePreferences ?? {}),
    },
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.settings,
  )) as Record<string, ExtensionSettings | undefined>;
  return migrateSettings(result[STORAGE_KEYS.settings] ?? {});
}

export async function updateSettings(partial: ExtensionSettingsPatch): Promise<ExtensionSettings> {
  const current = await getSettings();
  const nextFolders: LastUsedFolders = {
    ...current.lastUsedFolders,
    ...(partial.lastUsedFolders ?? {}),
  };
  if (Object.prototype.hasOwnProperty.call(partial, "lastUsedFolderPath")) {
    nextFolders.dropbox = partial.lastUsedFolderPath ?? null;
  }
  const nextLabels: LastUsedFolders = {
    ...current.lastUsedFolderLabels,
    ...(partial.lastUsedFolderLabels ?? {}),
  };
  if (nextFolders.dropbox !== current.lastUsedFolders.dropbox && partial.lastUsedFolderLabels?.dropbox === undefined) {
    nextLabels.dropbox = nextFolders.dropbox;
  }
  if (
    nextFolders.google_drive !== current.lastUsedFolders.google_drive
    && partial.lastUsedFolderLabels?.google_drive === undefined
  ) {
    nextLabels.google_drive = null;
  }

  const next: ExtensionSettings = {
    ...current,
    ...partial,
    lastUsedFolders: nextFolders,
    lastUsedFolderLabels: nextLabels,
    lastUsedFolderPath: nextFolders.dropbox,
    savePreferences: {
      ...current.savePreferences,
      ...(partial.savePreferences ?? {}),
    },
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

export async function setLastUsedFolder(
  provider: StorageProviderId,
  folderKey: string | null,
  label?: string | null,
): Promise<ExtensionSettings> {
  return updateSettings({
    lastUsedFolders: { [provider]: folderKey },
    lastUsedFolderLabels: { [provider]: label ?? (provider === "dropbox" ? folderKey : null) },
    lastUsedProvider: provider,
    ...(provider === "dropbox" ? { lastUsedFolderPath: folderKey } : {}),
  });
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

export async function getGoogleDriveTokens(): Promise<GoogleDriveTokens | null> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.googleDriveTokens,
  )) as Record<string, GoogleDriveTokens | null | undefined>;
  return result[STORAGE_KEYS.googleDriveTokens] ?? null;
}

export async function setGoogleDriveTokens(tokens: GoogleDriveTokens | null): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.googleDriveTokens]: tokens });
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

export async function clearRecentSaves(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.recentSaves);
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

export async function getSetupProgress(): Promise<SetupProgress> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.setupProgress,
  )) as Record<string, Partial<SetupProgress> | undefined>;
  return { ...defaultSetupProgress, ...(result[STORAGE_KEYS.setupProgress] ?? {}) };
}

export async function setSetupProgress(partial: Partial<SetupProgress>): Promise<SetupProgress> {
  const next = { ...(await getSetupProgress()), ...partial };
  await chrome.storage.local.set({ [STORAGE_KEYS.setupProgress]: next });
  return next;
}

export async function setLastResult(result: SaveResult | null): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.lastResult]: result });
}
