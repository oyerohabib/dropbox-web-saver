export type AssetType = "image" | "video" | "audio" | "link" | "unknown";
export type AssetTriggerKind =
  | "image"
  | "video"
  | "audio"
  | "linked_file"
  | "scan";
export type SaveMode = "reviewed" | "one_click";
export type FolderBehavior = "remember_last" | "always_ask";

export interface SavePreferences {
  saveMode: SaveMode;
  promptForRename: boolean;
  folderBehavior: FolderBehavior;
}

export interface AssetCandidate {
  sourceUrl: string;
  pageUrl: string;
  detectedType: AssetType;
  suggestedFilename: string | null;
  preferredFilename?: string | null;
  elementTextHint?: string | null;
  contentDispositionFilename?: string | null;
  requiresAuthenticatedFetch: boolean;
  referrer?: string;
  mimeType?: string | null;
  triggerKind?: AssetTriggerKind;
  width?: number;
  height?: number;
}

export interface SaveRequest {
  candidate: AssetCandidate;
  destinationPath?: string | null;
  tabId?: number;
  forceFolderPicker?: boolean;
  finalFilename?: string | null;
}

export interface SaveResult {
  ok: boolean;
  status:
    | "success"
    | "needs_auth"
    | "needs_folder"
    | "needs_permission"
    | "unsupported"
    | "failed";
  method?: "url_import" | "direct_upload";
  path?: string;
  filename?: string;
  errorCode?: SaveErrorCode;
  message: string;
  switchedToInstant?: boolean;
  /** Origin pattern (for example `https://cdn.example.com/*`) the user must allow before retrying. */
  permissionOrigin?: string;
}

export type SaveErrorCode =
  | "APP_KEY_MISSING"
  | "AUTH_REQUIRED"
  | "TOKEN_EXPIRED"
  | "UNSUPPORTED_TARGET"
  | "FOLDER_REQUIRED"
  | "FOLDER_NOT_FOUND"
  | "URL_IMPORT_FAILED"
  | "ASSET_FETCH_FAILED"
  | "UPLOAD_FAILED"
  | "SITE_PERMISSION_REQUIRED"
  | "UNKNOWN";

export interface DropboxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountEmail?: string;
}

export interface DropboxAuthState {
  status: "missing_app_key" | "signed_out" | "signed_in";
  appKey: string | null;
  redirectUri: string;
  accountEmail?: string;
  expiresAt?: number;
}

export interface FolderEntry {
  id: string;
  name: string;
  pathLower: string;
  pathDisplay: string;
}

export interface FolderSelectionState {
  currentPath: string;
  lastUsedFolderPath: string | null;
  entries: FolderEntry[];
}

export interface RecentSaveRecord {
  id: string;
  filename: string;
  sourceDomain: string;
  destinationPath: string;
  success: boolean;
  timestamp: number;
  method?: "url_import" | "direct_upload";
  message: string;
}

export interface ExtensionSettings {
  appKey: string | null;
  lastUsedFolderPath: string | null;
  savePreferences: SavePreferences;
  saveModeSetByUser: boolean;
}

export interface SetupProgress {
  createdApp: boolean;
  enabledScopes: boolean;
  addedRedirectUri: boolean;
}

export interface ExtensionSettingsPatch {
  appKey?: string | null;
  lastUsedFolderPath?: string | null;
  savePreferences?: Partial<SavePreferences>;
  saveModeSetByUser?: boolean;
}

export interface PendingSingleSaveState {
  mode: "single";
  request: SaveRequest;
  resolvedFilename: string;
  createdAt: number;
  reason: "auth_required" | "folder_required" | "permission_required" | "manual_override" | "context_review";
  permissionOrigin?: string;
}

export interface PendingScanState {
  mode: "scan";
  assets: AssetCandidate[];
  tabId?: number;
  destinationPath?: string | null;
  selectedSourceUrl?: string | null;
  selectedFilename?: string | null;
  createdAt: number;
  reason: "scan";
}

export interface AssetFetchPayload {
  ok: boolean;
  status: number;
  contentType: string | null;
  finalUrl?: string;
  contentDisposition?: string | null;
  arrayBuffer?: ArrayBuffer;
  base64?: string;
  error?: string;
}

export type PendingSaveState = PendingSingleSaveState | PendingScanState;

export type BackgroundMessage =
  | { type: "GET_AUTH_STATE" }
  | { type: "CONNECT_DROPBOX" }
  | { type: "DISCONNECT_DROPBOX" }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: ExtensionSettingsPatch }
  | { type: "SET_LAST_USED_FOLDER"; path: string | null }
  | { type: "LIST_FOLDERS"; path: string }
  | { type: "CREATE_FOLDER"; parentPath: string; name: string }
  | { type: "GET_PENDING_SAVE" }
  | {
      type: "SAVE_PENDING";
      destinationPath: string;
      candidate?: AssetCandidate;
      finalFilename?: string | null;
    }
  | { type: "GET_RECENT_SAVES" }
  | { type: "CLEAR_RECENT_SAVES" }
  | { type: "START_SCAN_FLOW" }
  | { type: "OPEN_FOLDER_SETTINGS" };

export interface BackgroundErrorResponse {
  backgroundError: true;
  message: string;
}

export type ContentScriptMessage =
  | { type: "PING" }
  | { type: "SCAN_PAGE_ASSETS" }
  | {
      type: "DESCRIBE_ASSET_TARGET";
      url: string;
      triggerKind?: AssetTriggerKind;
    }
  | {
      type: "FETCH_ASSET_BYTES";
      url: string;
      referrer?: string;
    }
  | {
      type: "SHOW_SAVE_STATUS";
      status: SaveToastStatus;
    };

export interface SaveToastStatus {
  state: "saving" | "success" | "error" | "hidden";
  filename?: string;
  folderPath?: string;
  message?: string;
  dropboxUrl?: string;
}

export interface ScanPageAssetsResponse {
  assets: AssetCandidate[];
}

export type StartScanFlowResponse =
  | { ok: true; flow: PendingScanState }
  | { ok: false; message: string };

export interface AssetDescriptionResponse {
  preferredFilename?: string | null;
  elementTextHint?: string | null;
  mimeType?: string | null;
  hasDownloadAttribute?: boolean;
}
