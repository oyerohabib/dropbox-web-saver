import type { StorageProviderId } from "../types";
import { dropboxProvider } from "./dropbox";
import { googleDriveProvider } from "./google-drive";
import type { StorageProvider } from "./types";

const providers: Record<StorageProviderId, StorageProvider> = {
  dropbox: dropboxProvider,
  google_drive: googleDriveProvider,
};

export function getStorageProvider(id: StorageProviderId): StorageProvider {
  return providers[id];
}

export function listStorageProviders(): StorageProvider[] {
  return Object.values(providers);
}

export function isStorageProviderId(value: string): value is StorageProviderId {
  return value === "dropbox" || value === "google_drive";
}

export function providerDisplayName(id: StorageProviderId): string {
  return getStorageProvider(id).displayName;
}

export type { StorageProvider, ProviderAuthState, UploadResult } from "./types";
