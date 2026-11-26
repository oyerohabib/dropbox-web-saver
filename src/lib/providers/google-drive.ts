import { GOOGLE_DRIVE_ROOT_FOLDER_KEY } from "../constants";
import {
  createGoogleDriveFolder,
  getGoogleDriveFolderName,
  getGoogleDriveWebUrl,
  listGoogleDriveFolders,
  uploadFileToGoogleDrive,
} from "../google-drive-api";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveAuthState,
} from "../google-drive-auth";
import type { StorageProvider } from "./types";

export const googleDriveProvider: StorageProvider = {
  id: "google_drive",
  displayName: "Google Drive",

  getRootFolderKey() {
    return GOOGLE_DRIVE_ROOT_FOLDER_KEY;
  },

  getAuthState() {
    return getGoogleDriveAuthState();
  },

  connect() {
    return connectGoogleDrive();
  },

  disconnect() {
    return disconnectGoogleDrive();
  },

  listFolders(folderKey) {
    return listGoogleDriveFolders(folderKey);
  },

  createFolder(parentKey, name) {
    return createGoogleDriveFolder(parentKey, name);
  },

  uploadFile(folderKey, filename, data) {
    return uploadFileToGoogleDrive(folderKey, filename, data);
  },

  getWebUrl(folderKey) {
    return getGoogleDriveWebUrl(folderKey);
  },

  joinFilePath(_folderKey, filename) {
    return filename;
  },

  formatFolderLabel(folderKey, pathDisplay) {
    if (pathDisplay) return pathDisplay;
    if (!folderKey || folderKey === GOOGLE_DRIVE_ROOT_FOLDER_KEY) {
      return "My Drive (top level)";
    }
    return folderKey;
  },

  async resolveFolderLabel(folderKey, pathDisplay) {
    if (pathDisplay) return pathDisplay;
    try {
      return await getGoogleDriveFolderName(folderKey);
    } catch {
      return googleDriveProvider.formatFolderLabel(folderKey);
    }
  },
};
