# Privacy Policy – Web Saver for Dropbox

Last updated October 11, 2026

## The short version

- There is no Web Saver server. The extension runs entirely in your browser.
- Your Dropbox app key, sign-in tokens, and settings are stored only in this browser's extension storage on your computer.
- The developer never receives your app key, tokens, files, or browsing activity. The only thing the developer ever gets is feedback you choose to send yourself.
- No analytics, no tracking, no ads, and nothing is sold or shared.

## What is stored on your computer

Everything below is kept in `chrome.storage.local`, which only this extension in this browser profile can read:

- **Your Dropbox app key**, which identifies the Dropbox app you created in your own account.
- **Dropbox sign-in tokens** (access token, refresh token, expiry) and the email address of the connected Dropbox account.
- **Your preferences**: save mode, folder behaviour, rename prompt, and the last folder you used.
- **Recent saves**: up to the last 20 saves, with file name, the website's domain, the destination folder, the time, and the result. You can clear this list at any time from the settings page.
- **Temporary save state**: while a review window is open, the address of the file you are saving. It is removed when the save finishes or the window closes.
- **Setup checklist**: which setup steps you have ticked.

## What is sent, and to whom

Web Saver only talks to two kinds of places, and only when you ask it to save something:

- **Dropbox** (`www.dropbox.com`, `api.dropboxapi.com`, `content.dropboxapi.com`), to sign you in, list and create folders, and upload the files you choose. For public files, Web Saver may ask Dropbox to download the file directly from its address, so Dropbox receives that address. Dropbox handles this data under the [Dropbox privacy policy](https://www.dropbox.com/privacy).
- **The website hosting the file** you chose to save, to download it and to check its file type. Requests use your normal browser session for that site, exactly as if you downloaded it yourself.

Nothing is sent to the developer or to any other service, unless you choose to send feedback as described below.

## Feedback

Sending feedback is always your choice, and you always send it yourself:

- **Send feedback** opens a GitHub issue form, or your email app, with your message filled in. Nothing is sent until you submit it there, and you can edit everything first.
- GitHub issues are public and are handled under the [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Emails go privately to the developer, who may copy the feedback into a GitHub issue without your name or email address.
- If **Include version and browser info** is on, the message includes the extension version, your browser and operating system (for example "Chrome 141 on macOS"), and whether Dropbox is connected. It never includes your app key, tokens, browsing history, or saved files.
- **Report this problem** in the review window copies the error message into the form. Error messages can mention a file's web address, so remove anything you don't want to share before submitting.
- When you uninstall the extension, your browser opens the GitHub feedback form so you can say why. Nothing is sent unless you submit it, and you can simply close the tab.

## Why the extension needs each permission

- **storage**: keep your app key, tokens, preferences, and recent saves on your computer.
- **contextMenus**: add the "Save … to Dropbox" items to the right-click menu.
- **identity**: open Dropbox's own sign-in window and receive the result securely.
- **scripting** and **activeTab**: only after you right-click "Save … to Dropbox" or click "Scan this page", access the tab you are on to find files on the page, fetch a file using your login on that site, and show the saving notice. Access ends when you leave or close the tab.
- **Access to a specific site (optional)**: Web Saver has no standing access to websites. If Dropbox can't fetch a file by itself, the extension asks you to allow that one site so it can download the file from your browser. You can decline, and you can remove access at any time from the extension's details page in Chrome.

## Why you create your own Dropbox app

Instead of routing everyone through a shared app owned by the developer, Web Saver connects through a Dropbox app that you create in your own account. Only you can see or manage it, and only you can revoke it. Sign-in uses OAuth with PKCE, so no app secret is ever needed or stored.

Web Saver requests the `account_info.read`, `files.metadata.read`, `files.metadata.write`, and `files.content.write` permissions. It never requests `files.content.read`, so it cannot read the contents of files already in your Dropbox.

## Your control

- **Disconnect** on the settings page signs out and revokes the extension's tokens.
- Revoke access at any time from [Dropbox → Settings → Connected apps](https://www.dropbox.com/account/connected_apps).
- Delete your Dropbox app from the [Dropbox App Console](https://www.dropbox.com/developers/apps).
- **Clear history** on the settings page removes the recent saves list.
- Removing the extension deletes everything it stored in your browser.

## Changes and contact

If this policy changes, the "Last updated" date above will change too. Questions: email oyerohabib@yahoo.com or [open an issue on GitHub](https://github.com/oyerohabib/dropbox-web-saver/issues).

Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc.
