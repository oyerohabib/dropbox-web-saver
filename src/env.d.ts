interface ImportMetaEnv {
  readonly WXT_DROPBOX_APP_KEY?: string;
  readonly WXT_GOOGLE_CLIENT_ID?: string;
  readonly WXT_GOOGLE_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
