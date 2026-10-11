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

export const SIMPLE_UPLOAD_LIMIT = 8 * 1024 * 1024;
export const CHUNK_SIZE = 8 * 1024 * 1024;
export const SAVE_URL_POLL_INTERVAL_MS = 1200;
export const SAVE_URL_POLL_TIMEOUT_MS = 45_000;
export const TOKEN_EXPIRY_SKEW_MS = 60_000;
export const RECENT_SAVE_LIMIT = 20;
export const BADGE_RESET_DELAY_MS = 10_000;
