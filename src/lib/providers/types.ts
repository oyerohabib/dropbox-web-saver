import type {
  FolderEntry,
  GoogleDriveAuthState,
  DropboxAuthState,
  StorageProviderId,
} from "../types";

export type ProviderAuthState = DropboxAuthState | GoogleDriveAuthState;

export interface UploadResult {
  pathDisplay: string;
  folderKey: string;
}

export interface StorageProvider {
  id: StorageProviderId;
  displayName: string;
  getRootFolderKey(): string;
  getAuthState(): Promise<ProviderAuthState>;
  connect(): Promise<ProviderAuthState>;
  disconnect(): Promise<void>;
  listFolders(folderKey: string): Promise<FolderEntry[]>;
  createFolder(parentKey: string, name: string): Promise<FolderEntry>;
  uploadFile(folderKey: string, filename: string, data: ArrayBuffer): Promise<UploadResult>;
  importFromUrl?(folderKey: string, filename: string, url: string): Promise<UploadResult>;
  getWebUrl(folderKey: string): string;
  joinFilePath(folderKey: string, filename: string): string;
  formatFolderLabel(folderKey: string, pathDisplay?: string | null): string;
  resolveFolderLabel(folderKey: string, pathDisplay?: string | null): Promise<string>;
}
