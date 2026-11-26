# Privacy Policy – Web Files to Cloud

Last updated November 26, 2026

## The short version

- There is no Web Saver server. The extension runs entirely in your browser.
- Sign-in tokens and settings are stored only in this browser's extension storage on your computer. Web Saver uses a public Dropbox app so you can connect with one click. That app key only identifies the extension to Dropbox. If you use your own Dropbox app, that key stays in this browser too. Google Drive uses a Google OAuth client id baked into the extension build.
- The developer never receives your tokens, files, or browsing activity. The only thing the developer ever gets is feedback you choose to send yourself.
- No analytics, no tracking, no ads, and nothing is sold or shared.
- The settings walkthrough loads from Loom while it is showing. Hiding it stops that. Loom does not receive your tokens or files.

## What is stored on your computer

Everything below is kept in `chrome.storage.local`, which only this extension in this browser profile can read:

- **Your own Dropbox app key**, only if you choose to connect with an app you created instead of Web Saver's. Web Saver's app key is part of the extension and only identifies it to Dropbox.
- **Dropbox sign-in tokens** (access token, refresh token, expiry) and the email address of the connected Dropbox account.
- **Google Drive sign-in tokens** (access token, refresh token, expiry) and the email address of the connected Google account, when you connect Google Drive.
- **Your preferences**: save mode, folder behaviour, rename prompt, the last Dropbox and Google Drive folders you used, and whether you hid the settings walkthrough.
- **Recent saves**: up to the last 20 saves, with file name, the website's domain, the destination folder, which cloud you saved to, the time, and the result. You can clear this list at any time from the settings page.
- **Temporary save state**: while a review window is open, the address of the file you are saving. It is removed when the save finishes or the window closes.
- **Setup checklist**: which setup steps you have ticked.

## What is sent, and to whom

When you save a file, Web Saver only talks to these places:

- **Dropbox** (`www.dropbox.com`, `api.dropboxapi.com`, `content.dropboxapi.com`), to sign you in, list and create folders, and upload the files you choose. For public files, Web Saver may ask Dropbox to download the file directly from its address, so Dropbox receives that address. Dropbox handles this data under the [Dropbox privacy policy](https://www.dropbox.com/privacy).
- **Google** (`accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`), when you connect or save to Google Drive, to sign you in, list and create folders, and upload the files you choose. Google handles this data under the [Google privacy policy](https://policies.google.com/privacy).
- **The website hosting the file** you chose to save, to download it and to check its file type. Requests use your normal browser session for that site, exactly as if you downloaded it yourself.

The settings page also loads a walkthrough video from Loom (`www.loom.com`) while that video is showing. Loom receives that request and handles it under the [Loom privacy policy](https://www.loom.com/privacy-policy). Hiding the walkthrough stops the player from loading. Web Saver does not send your Dropbox account, tokens, or files to Loom.

Nothing is sent to the developer or to any other service, unless you choose to send feedback as described below.

## Feedback

Sending feedback is always your choice, and you always send it yourself:

- **Send feedback** opens a GitHub issue form, or your email app, with your message filled in. Nothing is sent until you submit it there, and you can edit everything first.
- GitHub issues are public and are handled under the [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Emails go privately to the developer, who may copy the feedback into a GitHub issue without your name or email address.
- If **Include version and browser info** is on, the message includes the extension version, your browser and operating system (for example "Chrome 141 on macOS"), and whether Dropbox is connected. It never includes a personal app key, tokens, browsing history, or saved files.
- **Report this problem** in the review window copies the error message into the form. Error messages can mention a file's web address, so remove anything you don't want to share before submitting.
- When you uninstall the extension, your browser opens the GitHub feedback form so you can say why. Nothing is sent unless you submit it, and you can simply close the tab.

## Why the extension needs each permission

- **storage**: keep your tokens, an optional personal app key, preferences, and recent saves on your computer.
- **contextMenus**: add the "Save … to…" items (Dropbox / Google Drive) to the right-click menu.
- **identity**: open Dropbox or Google sign-in windows and receive the result securely.
- **Host access to Google APIs**: talk to Google for Drive sign-in, folder browsing, and uploads when you choose Google Drive.
- **scripting** and **activeTab**: only after you right-click a save action or click "Scan this page", access the tab you are on to find files on the page, fetch a file using your login on that site, and show the saving notice. Access ends when you leave or close the tab.
- **Access to a specific site (optional)**: Web Saver has no standing access to websites. If a cloud destination can't fetch a file by itself, the extension asks you to allow that one site so it can download the file from your browser. You can decline, and you can remove access at any time from the extension's details page in Chrome.

## How Dropbox sign-in works

Web Saver connects with OAuth and PKCE. No app secret is stored. By default it uses Web Saver's public Dropbox app, which only identifies the extension to Dropbox. Tokens stay in this browser, and the developer never receives them or your files.

You can instead create a Dropbox app in your own account and paste its app key in settings. That takes about 3 minutes. That key is stored only in this browser. Only you can manage that app, and only you can revoke it.

If you connected before this change by creating your own Dropbox app, that connection stays as it is. Updating the extension does not move you to Web Saver's app, does not replace your tokens, and does not change your preferences or recent saves. Your personal app key remains only on this computer. Disconnecting does not delete it. Clearing that saved key signs you out; the next connect can use Web Saver's app.

Web Saver requests the `account_info.read`, `files.metadata.read`, `files.metadata.write`, and `files.content.write` permissions. It never requests `files.content.read`, so it cannot read the contents of files already in your Dropbox.

## How Google Drive sign-in works

Google Drive uses OAuth and PKCE with a Web application client id (and client secret required by Google’s token endpoint). Those values identify the extension build to Google. Tokens stay in this browser, and the developer never receives them or your files.

Web Saver requests `drive` so it can list folders already in your Drive and save files into them, plus `userinfo.email` to show which Google account is connected. The extension does not browse or download files already in Drive. You can revoke access at any time from your Google account.

## Your control

- **Disconnect** on the settings page signs out and revokes the extension's tokens for that cloud.
- Revoke Dropbox access at any time from [Dropbox → Settings → Connected apps](https://www.dropbox.com/account/connected_apps).
- Revoke Google Drive access from [Google Account → Third-party access](https://myaccount.google.com/permissions).
- Delete a Dropbox app you created from the [Dropbox App Console](https://www.dropbox.com/developers/apps). Web Saver's shared app is revoked from Connected apps, not by deleting it.
- **Clear history** on the settings page removes the recent saves list.
- Removing the extension deletes everything it stored in your browser.

## Changes and contact

If this policy changes, the "Last updated" date above will change too. Questions: email oyerohabib@yahoo.com or [open an issue on GitHub](https://github.com/oyerohabib/dropbox-web-saver/issues).

Web Files to Cloud is an independent project and is not affiliated with or endorsed by Dropbox, Inc. or Google.
