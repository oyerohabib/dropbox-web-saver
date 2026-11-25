import {
  createFolder,
  listFolders,
  saveUrlToDropbox,
  uploadFileToDropbox,
} from "../dropbox-api";
import { connectDropbox, disconnectDropbox, getAuthState } from "../dropbox-auth";
import { joinDropboxPath } from "../utils/filename";
import { formatFolderPath } from "../utils/folder-path";
import { getDropboxWebUrl } from "../utils/url";
import type { StorageProvider } from "./types";

export const dropboxProvider: StorageProvider = {
  id: "dropbox",
  displayName: "Dropbox",

  getRootFolderKey() {
    return "/";
  },

  getAuthState() {
    return getAuthState();
  },

  connect() {
    return connectDropbox();
  },

  disconnect() {
    return disconnectDropbox();
  },

  listFolders(folderKey) {
    return listFolders(folderKey);
  },

  createFolder(parentKey, name) {
    return createFolder(parentKey, name);
  },

  async uploadFile(folderKey, filename, data) {
    const path = joinDropboxPath(folderKey, filename);
    const uploaded = await uploadFileToDropbox(path, data);
    return { pathDisplay: uploaded.pathDisplay, folderKey };
  },

  async importFromUrl(folderKey, filename, url) {
    const path = joinDropboxPath(folderKey, filename);
    const imported = await saveUrlToDropbox(path, url);
    return { pathDisplay: imported.pathDisplay, folderKey };
  },

  getWebUrl(folderKey) {
    return getDropboxWebUrl(folderKey);
  },

  joinFilePath(folderKey, filename) {
    return joinDropboxPath(folderKey, filename);
  },

  formatFolderLabel(folderKey) {
    return formatFolderPath(folderKey);
  },

  resolveFolderLabel(folderKey) {
    return Promise.resolve(formatFolderPath(folderKey));
  },
};
