# Web Saver for Dropbox

Private Chromium extension (Chrome, Brave, Edge) for saving images, videos, audio, and linked files from any web page straight into Dropbox, without downloading them locally first.

> Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc. It uses its own icon rather than the Dropbox logo, in line with the [Dropbox brand guidelines](https://www.dropbox.com/developers/reference/branding-guide).

## Features

- Right-click actions: **Save this image / video / audio to Dropbox** and **Save the file this link opens to Dropbox**
- **Find files on this page**: lists every image, video, audio file, and downloadable link on the current page so you can pick one
- Review window before each save: see the filename, rename it, and change the destination folder
- Dropbox folder browser with inline folder creation and a remembered default folder
- Per-user save preferences, reachable from the popup, the toolbar icon's right-click menu, the settings page, and every review window
- Save feedback: an in-page toast (saving, saved with an **Open in Dropbox** link, or failed with the reason) plus a toolbar badge
- Hybrid upload strategy:
  - Dropbox-side URL import for public assets
  - Direct upload of bytes fetched with the page's login session for private or same-site assets
- Recent saves log (last 20) with relative times, folder links, and a **Clear history** button

## Dropbox app setup

1. Create an app in the [Dropbox App Console](https://www.dropbox.com/developers/apps) with **Scoped access** and **Full Dropbox** access.
2. On the **Permissions** tab, enable only these scopes and click Submit:
   - `account_info.read`
   - `files.metadata.read`
   - `files.metadata.write`
   - `files.content.write`
3. Build and load the extension (next section). The settings page opens automatically on first install; click **Copy** next to the **Redirect URI**. It looks like `https://<extension-id>.chromiumapp.org/dropbox`.
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

- **Right-click an image, video, or audio element** and choose **Save this image / video / audio to Dropbox**.
- **Right-click a link** that points to a file (PDF, ZIP, image, or a link with a `download` attribute) and choose **Save the file this link opens to Dropbox**. Links to ordinary web pages are rejected with an error toast.
  - When an image is wrapped in a link, both items appear: the image item saves the picture you see, the link item saves whatever the link points to (often a larger original or a different file).
- **Find files on a page**: right-click an empty spot and choose **Find files on this page to save to Dropbox**, or open the toolbar popup and click **Scan this page**.
- **Change the default folder**: click **Change** next to the default folder in the popup or on the settings page. You can also change the folder inside any review window.
- While a save runs, a toast in the bottom-right corner of the page shows progress, then the result. The toolbar badge shows `…`, then `OK` or `ERR`. Browser-internal pages can't show toasts, so only the badge appears there.
- Closing a review window cancels that save.

## Save preferences

Preferences save automatically. Open them from any of these places:

- The **How saving works** card in the toolbar popup, or the gear icon in its header
- Right-click the toolbar icon, then **Save preferences**
- The top of the settings page
- **Change how saving works** at the bottom of every review window

| Preference | Options |
| --- | --- |
| When I save | **Review first** (default) shows the review window. **Save instantly** uploads straight to the remembered folder. |
| Folder | **Use last folder** (default) or **Ask every time** |
| Rename files | When on, the review window shows an editable filename |

Save instantly still opens the review window when a choice is needed: Dropbox isn't connected, no folder is remembered, the folder is set to ask every time, or renaming is on.

## Filenames

The extension uses the best name it can find, in this order: the link's `download` attribute, the file name in the URL, the server's `Content-Disposition` header, then the element's `alt`, `title`, or link text. When the URL has no extension (for example Unsplash image URLs), it asks the server for the content type and adds the matching extension. If a file with the same name already exists, Dropbox appends a number.

## Development

```bash
npx tsc --noEmit   # type check
npm run test       # Vitest unit tests
npm run build      # production build into .output/chrome-mv3
```

The toolbar icons are generated at build time from `src/assets/icon.svg` by `@wxt-dev/auto-icons`.

## Known limitations

- Chromium browsers only.
- Can't run on browser-internal pages such as `chrome://` pages and the Chrome Web Store.
- Assets fetched through the page's login session are limited to about 40 MB when transferred from the page. Larger files fall back to a direct fetch from the extension.
- Streamed video (HLS/DASH, `blob:` sources from players such as YouTube) and CSS background images aren't detected.
- The Dropbox app key and tokens are stored locally in the browser profile. There is no backend.
