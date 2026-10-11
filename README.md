# Dropbox Web Saver Extension

Private Chromium extension (Chrome, Brave, Edge) for saving images, videos, audio, and linked files from any web page straight into Dropbox, without downloading them locally first.

## Features

- Right-click actions: **Save image / video / audio to Dropbox** and **Save linked file to Dropbox**
- **Scan page assets**: lists every image, video, audio file, and downloadable link on the current page so you can pick one
- Review window before each save: see the filename, rename it, and change the destination folder
- Dropbox folder browser with inline folder creation and a remembered default folder
- Per-user save preferences (see below)
- Hybrid upload strategy:
  - Dropbox-side URL import for public assets
  - Direct upload of bytes fetched with the page's login session for private or same-site assets
- Recent saves log in the popup and settings page

## Dropbox app setup

1. Create an app in the [Dropbox App Console](https://www.dropbox.com/developers/apps) with **Scoped access** and **Full Dropbox** access.
2. On the **Permissions** tab, enable only these scopes and click Submit:
   - `account_info.read`
   - `files.metadata.read`
   - `files.metadata.write`
   - `files.content.write`
3. Build and load the extension (next section), open its settings page, and copy the **Redirect URI** shown there. It looks like `https://<extension-id>.chromiumapp.org/dropbox`.
4. In the Dropbox App Console **Settings** tab, add that exact URI under **OAuth 2 Redirect URIs**.
5. Copy the Dropbox **App key**, paste it into the extension settings page, click **Save App Key**, then **Connect Dropbox**.

The extension ID is stable as long as you load it from the same folder. Loading it from a new folder gives a new ID and a new redirect URI.

## Build and install

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select `.output/chrome-mv3`.
3. After each rebuild, click the reload icon on the extension card.

`npm run dev` starts WXT's dev mode with automatic reloads. `npm run zip` produces a shareable zip in `.output/`.

## Using it

- **Right-click an image, video, or audio element** and choose the matching "Save ... to Dropbox" action.
- **Right-click a link** that points to a file (PDF, ZIP, image, or a link with a `download` attribute) and choose **Save linked file to Dropbox**. Links to ordinary web pages are rejected.
- **Scan a page**: right-click an empty spot on the page and choose **Scan page assets for Dropbox**, or open the toolbar popup and click **Scan Page Assets**.
- **Change the default folder**: popup, then **Choose Folder**, or the settings page, then **Choose Default Folder**. You can also change the folder inside any review window.
- Closing a review window cancels that save.

## Save preferences

Set these on the settings page:

| Preference | Options |
| --- | --- |
| Save mode | **Reviewed** (default) shows the review window first. **One-click** saves immediately to the remembered folder. |
| Folder choice | **Remember last folder** (default) or **Ask every time** |
| Rename prompt | When enabled, the review window shows an editable filename |

One-click still opens the review window when a choice is needed: Dropbox isn't connected, no folder is remembered, folder choice is set to ask every time, or the rename prompt is on.

## Filenames

The extension uses the best name it can find, in this order: the link's `download` attribute, the file name in the URL, the server's `Content-Disposition` header, then the element's `alt`, `title`, or link text. When the URL has no extension (for example Unsplash image URLs), it asks the server for the content type and adds the matching extension. If a file with the same name already exists, Dropbox appends a number.

## Development

```bash
npx tsc --noEmit   # type check
npm run test       # Vitest unit tests
npm run build      # production build into .output/chrome-mv3
```

## Known limitations

- Chromium browsers only.
- Can't run on browser-internal pages such as `chrome://` pages and the Chrome Web Store.
- Assets fetched through the page's login session are limited to about 40 MB when transferred from the page. Larger files fall back to a direct fetch from the extension.
- Streamed video (HLS/DASH, `blob:` sources from players such as YouTube) and CSS background images aren't detected.
- The Dropbox app key and tokens are stored locally in the browser profile. There is no backend.
