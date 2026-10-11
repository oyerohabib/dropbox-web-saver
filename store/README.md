# Publishing to the Chrome Web Store

Everything needed to publish Web Saver for Dropbox: the upload package, images, the text for every field in the developer dashboard, and the steps in order.

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
Save images, videos, audio and files from any web page straight into your Dropbox, without downloading them to your computer first.

RIGHT-CLICK TO SAVE
• Right-click an image, video or audio player and choose "Save this … to Dropbox".
• Right-click a link to a PDF, document, archive or other file and choose "Save the file this link opens to Dropbox".
• A small notice on the page confirms each save, with an "Open in Dropbox" link.

SAVE A WHOLE PAGE OF FILES
• Choose "Find files on this page" from the right-click menu or the toolbar popup.
• See every photo, video, audio file and download on the page with thumbnails, sizes and file types.
• Tiny icons and avatars are hidden for you. Tick the files you want, or Select all, then save them in one go.
• A summary shows what was saved, and "Retry failed" re-tries anything that didn't make it.

YOUR FOLDERS, YOUR WAY
• Browse your Dropbox folders, create a new folder on the spot, and set a default.
• Your first save opens a short review so you can pick the folder. After that, saves go straight there. Prefer to review every time? One click keeps the review window.
• Optionally rename files before saving.
• Recent saves are listed in the popup with links to their folders.

SUPPORTED FILES
Images (jpg, png, gif, webp, avif, heic, svg and more), video (mp4, webm, mov, mkv and more), audio (mp3, m4a, wav, ogg, flac and more), documents (pdf, docx, xlsx, pptx, txt, csv, epub and more), archives (zip, rar, 7z, tar, gz) and design files (psd, ai, fig, sketch). Images, videos and audio you right-click are saved whatever their format.

PRIVATE BY DESIGN
• You connect your own Dropbox app in about 3 minutes. A built-in guide walks you through each step with copy buttons.
• Your app key and sign-in tokens stay in your browser. There is no Web Saver server, no analytics and no tracking.
• Files go from the website or Dropbox straight into your Dropbox. The developer never sees them.
• Web Saver asks Dropbox for permission to add files, not to read the files already in your Dropbox.

OPEN SOURCE
Web Saver is free and open source under the MIT license. Code, feature ideas and bug reports: https://github.com/oyerohabib/dropbox-web-saver

Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc.
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

- Title: `Web Saver for Dropbox`
- Summary: `Save images, videos, audio and files from any web page straight to your Dropbox. Not affiliated with Dropbox, Inc.`

## 5. Privacy tab

**Single purpose description:**

```text
Web Saver saves files from web pages (images, videos, audio and linked files) into the user's own Dropbox account, either one file at a time from the right-click menu or several at once after scanning the current page.
```

**Permission justifications:**

| Permission | Justification to paste |
| --- | --- |
| `storage` | Stores the user's Dropbox app key, Dropbox sign-in tokens, save preferences, last used folder and a list of the last 20 saves in chrome.storage on the user's device. None of it is sent to the developer. |
| `contextMenus` | Adds the right-click items "Save this image/video/audio to Dropbox", "Save the file this link opens to Dropbox" and "Find files on this page to save to Dropbox", plus "Save preferences" on the toolbar icon's menu. These are the main way users start a save. |
| `identity` | Uses chrome.identity.launchWebAuthFlow to show Dropbox's own OAuth sign-in window (with PKCE) and receive the authorization code at the extension's chromiumapp.org redirect URI. |
| `scripting` | Injects the extension's own bundled content script into the current tab when the user scans a page or saves a file from a tab that was already open before the extension was installed or updated. No remote code is ever injected. |
| `activeTab` | Gives access to the tab the user is on when they click "Scan this page" in the toolbar popup, so the page can be scanned for files the user then chooses to save. |
| Host permissions (`http://*/*`, `https://*/*`) | Users save files from whatever website they are on, so the extension must work on all http and https pages. It uses this access to: list the images, videos, audio and file links on the page when the user asks for a scan; download the chosen file with the page's own login session when the file isn't publicly reachable (for example a private image on a site the user is signed into) and upload it to Dropbox; check a link's file type before saving; and show a small "Saved to Dropbox" notice on the page. The content script does nothing until the user saves or scans, and never reads or sends page content on its own. |

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

Reviewers can't test the extension without a connected Dropbox app, and an untestable extension is a common rejection reason. Give them a ready-made one:

1. Create a separate Dropbox account for reviewers (for example `websaver.review@<your-domain>`). Don't use your personal account.
2. In that account, create a Dropbox app following the setup guide. Name it `Web Saver Review`, choose Scoped access and Full Dropbox, and tick the four permissions.
3. Under **OAuth 2 → Redirect URIs**, add `https://<item-id>.chromiumapp.org/dropbox`, using the item ID from step 3.
4. Copy the app's **App key** (not the secret).
5. Paste this into the Test instructions tab, filling in the placeholders:

```text
Web Saver connects through a Dropbox app that each user creates in their own Dropbox account. To save time, use this pre-made test setup:

Dropbox test account: <reviewer email>
Password: <password>
App key: <app key>

1. After installing, the settings page opens with a setup guide. Steps 1-3 are already done for this test account, so tick them or skip to step 4.
2. Step 4: paste the app key above and click Save.
3. Step 5: click Connect Dropbox and sign in with the test account, then click Allow.
4. Open any web page with images (for example https://unsplash.com), right-click an image and choose "Save this image to Dropbox". The first save opens a window to pick a folder; click Save to Dropbox. A "Saved to Dropbox" notice appears on the page.
5. To save several files: right-click an empty part of the page and choose "Find files on this page to save to Dropbox", tick some files and click "Save N files".
6. Saved files can be checked at https://www.dropbox.com/home after signing in with the test account.
```

Keep 2-step verification off on the test Dropbox account, so reviewers can sign in with just the email and password. Before submitting, sign in once from a private browser window to confirm it works without a code.

## 8. Submit

1. Check that every tab shows no warnings, then click **Submit for review**.
2. Choose whether to publish automatically once approved. Deferred publishing lets you pick the moment yourself, but you must publish within 30 days of approval.
3. Reviews usually take a few days. Access to all websites (`http://*/*`, `https://*/*`) triggers an extra in-depth review, so allow a week or more. The dashboard warns about this on upload; that's expected.

## 9. After it's live

- Add the store link to the top of the main README, for example with a "Get it on the Chrome Web Store" badge.
- Anyone who used an unpacked copy before needs to add the published redirect URI (`https://<item-id>.chromiumapp.org/dropbox`) to their Dropbox app, because the store version has a different extension ID. The setup guide shows the right URI automatically.
- Each user creates their own Dropbox app with a single user, so Dropbox's production approval for apps with many users never applies.

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
| Reviewer couldn't test it | Step 7 gives reviewers a ready-made Dropbox account and app key. |
| Misleading screenshots | The screenshots are rendered from the real extension pages. Only the sample web page and data are made up. |
| Keyword stuffing | The description is written for people and doesn't repeat search keywords. |
