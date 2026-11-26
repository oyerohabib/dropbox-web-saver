export const DROPBOX_SCOPES = [
  "account_info.read",
  "files.metadata.read",
  "files.content.write",
  "files.metadata.write",
] as const;

export const DROPBOX_API_BASE = "https://api.dropboxapi.com/2";
export const DROPBOX_CONTENT_API_BASE = "https://content.dropboxapi.com/2";
export const DROPBOX_OAUTH_AUTHORIZE = "https://www.dropbox.com/oauth2/authorize";
export const DROPBOX_OAUTH_TOKEN = "https://api.dropboxapi.com/oauth2/token";
export const DROPBOX_OAUTH_REVOKE = "https://api.dropboxapi.com/2/auth/token/revoke";

/** Full Drive: list existing folders and save into them. `drive.file` cannot see folders it did not create. */
export const GOOGLE_DRIVE_FULL_SCOPE = "https://www.googleapis.com/auth/drive";
export const GOOGLE_DRIVE_SCOPES = [
  GOOGLE_DRIVE_FULL_SCOPE,
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export function googleDriveCanListExistingFolders(scope?: string | null): boolean {
  return (scope ?? "").split(/\s+/).includes(GOOGLE_DRIVE_FULL_SCOPE);
}
export const GOOGLE_OAUTH_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_REVOKE = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
export const GOOGLE_DRIVE_UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3";
export const GOOGLE_DRIVE_ROOT_FOLDER_KEY = "root";
export const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

export const SIMPLE_UPLOAD_LIMIT = 8 * 1024 * 1024;
export const CHUNK_SIZE = 8 * 1024 * 1024;
// Chrome caps extension messages at 64 MB and base64 inflates payloads by ~33%.
export const MAX_TAB_TRANSFER_BYTES = 40 * 1024 * 1024;
export const SAVE_URL_POLL_INTERVAL_MS = 1200;
export const SAVE_URL_POLL_TIMEOUT_MS = 45_000;
export const TOKEN_EXPIRY_SKEW_MS = 60_000;
export const RECENT_SAVE_LIMIT = 20;
export const BADGE_RESET_DELAY_MS = 10_000;
