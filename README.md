# Dropbox Web Saver Extension

Private Chromium extension for saving web assets directly into Dropbox without a local download/upload hop.

## Features

- Right-click save for images, videos, audio files, and asset links
- Toolbar popup to scan the current page and save detected assets
- Dropbox OAuth with PKCE
- Folder selection, remembered last-used folder, and inline folder creation
- Hybrid upload strategy:
  - Dropbox-side URL import for public assets
  - Direct byte upload fallback for authenticated or protected assets
- Local audit trail for recent saves

## Setup

1. Create a Dropbox API app with `Full Dropbox` access.
2. Enable scopes for account info, file metadata read, file write, and folder write.
3. In Dropbox App Console, add the extension redirect URI shown on the options page to the app's redirect URIs.
4. Install dependencies:

```bash
npm install
```

5. Run the extension locally:

```bash
npm run dev
```

6. Load the generated Chromium build as an unpacked extension.

## Notes

- The extension stores the Dropbox app key locally and uses PKCE, so no backend is required in v1.
- The first version targets Chromium browsers only.
