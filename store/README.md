# Publishing to the Chrome Web Store

Everything needed to publish Web Files to Cloud: the upload package, images, the text for every field in the developer dashboard, and the steps in order.

## What's in this folder

| File | Use it for | Size |
| --- | --- | --- |
| `images/store-icon.png` | Store icon | 128 × 128 |
| `images/01-right-click.png` | Screenshot 1 | 1280 × 800 |
| `images/02-find-files.png` | Screenshot 2 | 1280 × 800 |
| `images/03-review.png` | Screenshot 3 | 1280 × 800 |
| `images/04-popup.png` | Screenshot 4 | 1280 × 800 |
| `images/05-setup.png` | Screenshot 5 | 1280 × 800 |
| `images/promo-small.png` | Small promo tile | 440 × 280 |
| `images/promo-marquee.png` | Marquee promo tile (optional) | 1400 × 560 |

The images are rendered from the real extension pages with sample data. To regenerate them after a UI change, run `./store/capture.sh` on a Mac with Google Chrome installed. The scenes live in `store/scenes/`, and `store/scenes/mock.js` holds the sample data.

## 1. One-time account setup

1. Go to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) and sign in with the Google account that should own the listing.
2. Accept the developer agreement and pay the one-time US$5 registration fee.
3. Turn on 2-Step Verification for that Google account. The dashboard requires it before you can publish.
4. Open **Account** in the dashboard:
   - Set the **publisher name** shown on the listing (for example your name).
   - Add and verify a **contact email**. Publishing is blocked until it's verified.
   - Complete the **trader / non-trader** declaration. If you publish this as a free, personal open-source project, choose **non-trader**. If you choose trader, your address and phone number are shown publicly to EU users.

## 2. Build the package

```bash
npm install
npm run test
npm run zip
```

The upload file is `.output/dropbox-web-saver-extension-<version>-chrome.zip`. The version comes from `package.json`.

Before uploading, unzip it to a new folder, load that folder with **Load unpacked** in `chrome://extensions`, and do one real save. This catches anything missing from the package.

## 3. Create the item

1. In the dashboard, click **New item** and upload the zip.
2. The item opens with a draft listing. Note the **item ID** at the top (32 lowercase letters). The published extension uses it, so its Dropbox redirect URI will be `https://<item-id>.chromiumapp.org/dropbox`. You need this for the reviewer test setup in step 7.

## 4. Store listing tab

**Description** (paste as is; the store shows plain text and keeps line breaks):

```text
Save images, videos, audio and files from any web page straight into your Dropbox or Google Drive, without downloading them to your computer first.

RIGHT-CLICK TO SAVE
• Right-click an image, video or audio player and choose "Save this … to…", then Dropbox or Google Drive.
• Right-click a link to a PDF, document, archive or other file and choose "Save the file this link opens to…", then Dropbox or Google Drive.
• A small notice on the page confirms each save, with an "Open in Dropbox" or "Open in Google Drive" link.

SAVE A WHOLE PAGE OF FILES
• Choose "Find files on this page" from the right-click menu or the toolbar popup.
• See every photo, video, audio file and download on the page with thumbnails, sizes and file types.
• Tiny icons and avatars are hidden for you. Tick the files you want, or Select all, then save them in one go.
• Save to Dropbox, Google Drive, or both at once, each with its own folder.
• A summary shows what was saved, and "Retry failed" re-tries anything that didn't make it.

YOUR FOLDERS, YOUR WAY
• Browse your Dropbox or Google Drive folders, create a new folder on the spot, and set a default for each cloud.
• Your first save to a cloud opens a short review so you can pick the folder. After that, saves go straight there. Prefer to review every time? One click keeps the review window.
• Optionally rename files before saving.
• Recent saves are listed in the popup with links to their folders.

SUPPORTED FILES
Web Saver works with the common types of images, videos, audio, documents, archives and design files. Any image, video or audio you right-click is saved whatever its format. The full list is on the extension's settings page.

PRIVATE BY DESIGN
• Connect Dropbox in about 5 seconds. Sign in if asked, then click Allow. Connect Google Drive the same way.
• Prefer your own Dropbox app? An optional guide takes about 3 minutes. That app key stays in your browser too.
• Sign-in tokens stay in your browser. There is no Web Saver server, no analytics and no tracking.
• Files go from the website straight into your Dropbox or Google Drive. The developer never sees them.
• For Dropbox, Web Saver asks permission to add files, not to read the files already in your Dropbox. For Google Drive, it lists your folders so you can save into them; it does not download files already in Drive.

OPEN SOURCE
Web Saver is free and open source under the MIT license. Code, feature ideas and bug reports: https://github.com/oyerohabib/dropbox-web-saver

Web Files to Cloud is an independent project and is not affiliated with or endorsed by Dropbox, Inc. or Google.
```

**Other fields:**

| Field | Value |
| --- | --- |
| Category | Productivity → Tools |
| Language | English |
| Store icon | `images/store-icon.png` |
| Screenshots | `01` to `05`, uploaded in that order |
| Small promo tile | `images/promo-small.png` |
| Marquee promo tile | `images/promo-marquee.png` (optional, only used if Google features the extension) |
| Global promo video | Leave empty |
| Official URL | Leave as "None" (it needs a domain verified in Google Search Console) |
| Homepage URL | `https://github.com/oyerohabib/dropbox-web-saver` |
| Support URL | `https://github.com/oyerohabib/dropbox-web-saver/issues` |
| Mature content | No |

The listing's title and summary come from the manifest, so they aren't edited here:

- Title: `Web Files to Cloud: Save to Drive & Dropbox`
- Summary: `Save images, videos, audio and files from any page to Google Drive or Dropbox. Not affiliated with Google or Dropbox, Inc.`

## 5. Privacy tab

**Single purpose description:**

```text
Web Saver saves files from web pages (images, videos, audio and linked files) into the user's own Dropbox account, either one file at a time from the right-click menu or several at once after scanning the current page.
```

**Permission justifications:**

| Permission | Justification to paste |
| --- | --- |
| `storage` | Stores Dropbox sign-in tokens, save preferences, the last used folder and a list of the last 20 saves in chrome.storage on the user's device. A personal Dropbox app key is stored there only if the user chooses their own app instead of Web Saver's. None of it is sent to the developer. |
| `contextMenus` | Adds the right-click items "Save this image/video/audio to Dropbox", "Save the file this link opens to Dropbox" and "Find files on this page to save to Dropbox", plus "Save preferences" on the toolbar icon's menu. These are the main way users start a save. |
| `identity` | Uses chrome.identity.launchWebAuthFlow to show Dropbox's own OAuth sign-in window (with PKCE) and receive the authorization code at the extension's chromiumapp.org redirect URI. |
| `scripting` | The extension has no content script that runs on its own. Only after the user picks a "Save … to Dropbox" right-click item or clicks "Scan this page", it injects its own bundled script into that tab to list the files on the page, download the chosen file with the page's login session when it isn't publicly reachable, and show a small "Saved to Dropbox" notice. No remote code is ever injected. |
| `activeTab` | Gives temporary access to the tab the user is on, only after they pick a "Save … to Dropbox" right-click item or click "Scan this page" in the toolbar popup. This is what lets the extension work on any site without asking for access to all websites. |
| Optional host permissions (`http://*/*`, `https://*/*`) | Not granted at install. When Dropbox can't fetch a file by itself and the browser blocks the download from the file's site (for example images served from a separate CDN), the save window asks the user to allow that one site (for example `https://cdn.example.com/*`) with Chrome's permission prompt. The extension then downloads the file and uploads it to the user's Dropbox. The user can decline, and can remove access from the extension's details page. |

**Remote code:** choose **No, I am not using remote code**. All JavaScript is bundled in the package.

**Data usage:** tick these three, because the extension handles them even though nothing goes to the developer:

| Data type | Why |
| --- | --- |
| Personally identifiable information | The Dropbox account email is read from Dropbox and shown in the extension. It's stored only on the device. |
| Authentication information | Dropbox sign-in tokens are stored on the device and sent only to Dropbox. |
| Website content | The files the user chooses to save, and their web addresses, are sent to the user's Dropbox. |

Then tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:**

```text
https://github.com/oyerohabib/dropbox-web-saver/blob/main/PRIVACY.md
```

The repository must stay public for this link to work. The same policy ships inside the extension as `privacy.html`.

## 6. Distribution tab

| Field | Value |
| --- | --- |
| Payments | Free of charge |
| Visibility | **Public**. Choose **Unlisted** for a soft launch where only people with the link can install it. |
| Regions | All regions |

## 7. Test instructions tab

Reviewers need a Dropbox account they can sign in to. The published package already includes Web Saver's public app key, so they do not create an app or paste a key. Before you submit, register `https://<item-id>.chromiumapp.org/dropbox` on Web Saver's Dropbox app (Allow public clients on) and confirm **Connect Dropbox** works in the store build.

1. Create a separate Dropbox account for reviewers (for example `websaver.review@<your-domain>`). Don't use your personal account.
2. Paste this into the Test instructions tab, filling in the placeholders:

```text
Web Saver connects with Dropbox's own sign-in window. No app key is required.

Dropbox test account: <reviewer email>
Password: <password>

1. After installing, the settings page opens. Click Connect Dropbox. This takes about 5 seconds.
2. Sign in with the test account and click Allow.
3. Open any web page with images (for example https://unsplash.com), right-click an image and choose "Save this image to Dropbox". The first save opens a window to pick a folder; click Save to Dropbox. A "Saved to Dropbox" notice appears on the page.
4. To save several files: right-click an empty part of the page and choose "Find files on this page to save to Dropbox", tick some files and click "Save N files".
   If Dropbox can't fetch a file by itself, the save window asks to allow that file's site. Click "Allow access and save" and accept Chrome's prompt; access is limited to that one site.
5. Saved files can be checked at https://www.dropbox.com/home after signing in with the test account.
```

Keep 2-step verification off on the test Dropbox account, so reviewers can sign in with just the email and password. Before submitting, sign in once from a private browser window to confirm it works without a code.

## 8. Submit

1. Check that every tab shows no warnings, then click **Submit for review**.
2. Choose whether to publish automatically once approved. Deferred publishing lets you pick the moment yourself, but you must publish within 30 days of approval.
3. Reviews usually take a few days. The extension doesn't request access to all websites at install (it uses `activeTab` and asks for one site at a time when needed), so it shouldn't trigger the "Broad Host Permissions" in-depth review.

## 9. After it's live

- Add the store link to the top of the main README, for example with a "Get it on the Chrome Web Store" badge.
- People who already connected with their own Dropbox app stay on that app after an update. They are not moved to the shared app, and they are not signed out. Their folder, preferences, and recent saves stay.
- Someone who used their own app in an unpacked copy, then installs the store version, has a different extension id. They need to add `https://<item-id>.chromiumapp.org/dropbox` to that personal app, or clear the saved key and use **Connect Dropbox** on the shared app.
- The shared app links many users, so Dropbox's production approval applies once it passes 50 linked users. Register the store redirect before publishing.

## Publishing an update

1. Bump `version` in `package.json` (for example `0.1.0` to `0.2.0`). The store rejects a package whose version isn't higher than the live one.
2. Run `npm run test` and `npm run zip`.
3. In the dashboard, open the item, go to **Package**, click **Upload new package**, and choose the new zip.
4. If the UI changed, run `./store/capture.sh` and replace the screenshots on the Store listing tab.
5. Click **Submit for review**.

## Common rejection reasons, and how this listing avoids them

| Reason | How it's handled |
| --- | --- |
| Trademark or impersonation | The name uses "for Dropbox", the icon is original rather than the Dropbox logo, and the listing and manifest say it isn't affiliated with Dropbox, Inc. |
| Permissions not justified | Every permission has a justification above that matches what the code does. |
| Missing or mismatched privacy disclosures | The data usage answers match the privacy policy, which is public and also bundled in the extension. |
| Reviewer couldn't test it | Step 7 gives reviewers a Dropbox account. They click Connect Dropbox. The store redirect must already be on Web Saver's Dropbox app. |
| Misleading screenshots | The screenshots are rendered from the real extension pages. Only the sample web page and data are made up. |
| Keyword stuffing | The description is written for people and doesn't repeat search keywords. Don't list file extensions (jpg, png, pdf…) in the description; version 0.1.0 was rejected for that ("Yellow Argon"). |
