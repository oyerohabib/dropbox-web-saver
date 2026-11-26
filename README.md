# Web Files to Cloud

This project was previously named **Web Saver for Dropbox**. The listing is now **Web Files to Cloud** because the extension saves to Google Drive as well as Dropbox.

[![CI](https://github.com/oyerohabib/dropbox-web-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/oyerohabib/dropbox-web-saver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Open-source Chromium extension (Chrome, Brave, Edge) that saves images, videos, audio, and linked files from any page into Dropbox or Google Drive without downloading them first. There is no server; you sign in in the browser and tokens stay on this computer. Connecting takes about 5 seconds for Dropbox, and the same for Google Drive.

> Web Files to Cloud is an independent project and is not affiliated with or endorsed by Dropbox, Inc. or Google. It uses its own icon rather than the Dropbox or Google Drive logos, in line with the [Dropbox brand guidelines](https://www.dropbox.com/developers/reference/branding-guide).

## Walkthrough

[![How to Save Web Assets to Dropbox](https://cdn.loom.com/sessions/thumbnails/c74743c06c9241ceb1d7588408c8e656-ef66f4a14827963e.gif)](https://www.loom.com/share/c74743c06c9241ceb1d7588408c8e656)

## Features

- **Connect Dropbox** or **Connect Google Drive**: sign in if asked, then **Allow**. A personal Dropbox app is optional in settings.
- Right-click **Save this image / video / audio to…** or **Save the file this link opens to…**, then **Dropbox** or **Google Drive**. If an image sits inside a link, both items appear: the image item saves what you see, the link item saves the destination. Ordinary web-page links are rejected.
- **Find files on this page** (right-click empty space, or **Scan this page** in the popup): videos, audio, and linked files first, then images from largest to smallest. Nothing is ticked until you choose. Small images (avatars, icons) stay hidden unless you turn on **Show small images**. Tick files, **Select all**, or **Clear**, then save to one or both clouds. Keep the window open while it saves; **Retry failed** retries only failures.
- Review window: filename, optional rename, and folder. **Change** opens the folder browser (breadcrumbs, **Up**, **+ New folder**). **Use this folder** applies to that save; **Cancel** keeps the previous folder; closing the window cancels the save. Set a default from the popup or settings.
- Preferences from the popup, the toolbar icon menu, settings, and every review window. See [Save preferences](#save-preferences).
- In-page toast (saving, saved with **Open in Dropbox** or **Open in Google Drive**, or the error) plus a toolbar badge (`…`, `OK`, `ERR`). Browser-internal pages show only the badge.
- Public files can be imported by Dropbox from the URL; private or same-site files are fetched with the page's login session and uploaded.
- No website access at install (`activeTab`). If a file's site (for example a CDN) blocks the download, the save window asks you to allow that one site.
- Last 20 saves with folder links and **Clear history**.
- Common image, video, audio, document, archive, and design formats. See [Supported files](#supported-files).

## Supported files

Right-clicking an image, video, or audio element saves whatever format that element is showing.

Links and **Find files on this page** recognise files by the extension in the URL:

| Type | Extensions |
| --- | --- |
| Images | jpg, jpeg, png, gif, webp, avif, heic, heif, svg, bmp, tif, tiff |
| Video | mp4, webm, mov, m4v, mkv, avi, mpeg, mpg, ogv, 3gp |
| Audio | mp3, m4a, aac, wav, ogg, oga, opus, flac |
| Documents | pdf, doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp, rtf, txt, csv, epub |
| Archives | zip, rar, 7z, tar, gz |
| Design files | psd, ai, eps, fig, sketch, xd |

A link to any other file still works when it has a `download` attribute, or when the site sends it as a download rather than a web page. Streamed video and `blob:` sources cannot be saved (see [Known limitations](#known-limitations)). The same list is on the settings page. Update this table when you change `src/lib/utils/file-types.ts`; the scanner, link check, and settings page all read from it.

## Connect

**Dropbox:** click **Connect Dropbox**, sign in if asked, click **Allow**. Tokens stay in this browser. The package includes a public app key (`WXT_DROPBOX_APP_KEY`) that only identifies the extension; it is not a password. Register `https://<extension-id>.chromiumapp.org/dropbox` on that Dropbox app with **Allow public clients**. Do not add a new `manifest.key` after publishing: that would change the id and the redirect would stop matching.

**Google Drive:** uses a Web application OAuth client (`WXT_GOOGLE_CLIENT_ID` and `WXT_GOOGLE_CLIENT_SECRET` in gitignored `.env`). Chrome Extension clients do not work. Redirect URI: `https://<extension-id>.chromiumapp.org/`. Scopes: `drive` (list existing folders and save into them) and `userinfo.email`.

If Dropbox is already connected through an app you created, you stay signed in; settings says **Using your own Dropbox app.** **Disconnect** keeps the saved key. To use the shared app, clear that key under **Change your Dropbox app**, then connect again. Files already in Dropbox stay put; revoke the old app at [Dropbox → Connected apps](https://www.dropbox.com/account/connected_apps) if you want it gone. A local build with `WXT_DROPBOX_APP_KEY` empty still uses a personal app. An unpacked copy from a new folder gets a new extension id, so register that redirect or use your own app.

## Privacy

Sign-in tokens, preferences, and recent saves live only in this browser's extension storage. A personal Dropbox app key, if you add one, stays there too. There is no extra server and no analytics. Saving talks to Dropbox or Google and to the site hosting the file. The settings walkthrough loads from Loom while it is visible; hiding it stops that. The shared Dropbox app key only identifies the extension to Dropbox.

The full policy is `privacy.html` in the extension and [PRIVACY.md](PRIVACY.md) for the Chrome Web Store. Keep `PRIVACY.md` and `src/entrypoints/privacy/App.tsx` in sync.

## Feedback and bug reports

All feedback becomes a [GitHub issue](https://github.com/oyerohabib/dropbox-web-saver/issues) so it can be tracked.

- **In the extension:** **Send feedback** or **Report a bug** in the popup or settings, or **Report this problem** next to a review-window error. Pick bug, feature idea, or other feedback, then **Continue on GitHub** (prefilled issue; needs a GitHub account) or **Email instead**. An optional toggle adds version, browser, and whether Dropbox is connected; it never includes keys, tokens, pages, or files.
- **On GitHub:** [open an issue](https://github.com/oyerohabib/dropbox-web-saver/issues/new/choose) and choose **Bug report**, **Feature idea**, or **General feedback**.
- **On uninstall:** the browser opens the feedback form.

Issue form field ids in `.github/ISSUE_TEMPLATE/` must match the parameters built in `src/lib/project.ts` (covered by tests).

## Build and install

```bash
git clone https://github.com/oyerohabib/dropbox-web-saver.git
cd dropbox-web-saver
npm install
npm run build
```

In Chrome, open `chrome://extensions`, turn on **Developer mode**, **Load unpacked**, and select `.output/chrome-mv3`. Reload the extension card after each rebuild.

```bash
npx tsc --noEmit   # type check
npm run test       # Vitest unit tests
npm run dev        # WXT dev mode with automatic reloads
npm run zip        # shareable zip in .output/
```

Toolbar icons are generated at build time from `src/assets/icon.svg` by `@wxt-dev/auto-icons`. Chrome Web Store listing copy, screenshots, and capture scripts live in the local `store/` folder (gitignored).

## Save preferences

Preferences save automatically. Open them from **How saving works** in the popup (or the gear), **Save preferences** on the toolbar icon, the top of settings, or **Change how saving works** in a review window.

| Preference | Options |
| --- | --- |
| When I save | **Review first** shows the review window. **Save instantly** uploads to the remembered folder. New installs review the first save, then switch to instant; they never switch again after you pick a mode yourself. |
| Folder | **Use last folder** (default) or **Ask every time** |
| Rename files | When on, the review window shows an editable filename |

Your first save opens the review window so you can pick a folder. After it succeeds, later saves go straight there unless you click **Keep reviewing each save**. The automatic switch only happens when the folder setting is **Use last folder** and renaming is off. Save instantly still opens the window if Dropbox or Drive is not connected, no folder is remembered, the folder is set to ask every time, or renaming is on.

## Filenames

The best name is chosen in this order: the link's `download` attribute, the file name in the URL, the server's `Content-Disposition` header, then the element's `alt`, `title`, or link text. When the URL has no extension, the server content type supplies one. If a file with the same name already exists, Dropbox appends a number.

## Known limitations

- Chromium browsers only. Cannot run on `chrome://` pages or the Chrome Web Store.
- Assets fetched through the page's login session are limited to about 40 MB when transferred from the page. Larger files fall back to a direct fetch from the extension.
- Some files (for example images on a separate CDN) can only be saved after you allow their site in the save window. Remove that access from the extension's details page in Chrome.
- Streamed video (HLS/DASH, `blob:` sources from players such as YouTube) and CSS background images are not detected.
- Sign-in tokens are stored locally in the browser profile. There is no backend.

## Contributing

Pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, project structure, and the pull request checklist. CI runs the type check, tests, and build on every pull request. Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Good first steps: browse [open issues](https://github.com/oyerohabib/dropbox-web-saver/issues), or pick something from **Known limitations** above.

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues.

## License

[MIT](LICENSE) © 2026 oyerohabib
