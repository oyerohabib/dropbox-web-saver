import type { ReactNode } from "react";
import { CONTACT_EMAIL, ISSUES_URL, PRODUCT_NAME } from "../../lib/project";

const LAST_UPDATED = "November 26, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel stack policy-section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export function PrivacyApp() {
  return (
    <div className="app-shell page policy">
      <section className="hero">
        <div className="row" style={{ gap: 12 }}>
          <img alt="" src="/icons/48.png" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <div className="eyebrow">{PRODUCT_NAME}</div>
            <h1>Privacy policy</h1>
          </div>
        </div>
        <p>Last updated {LAST_UPDATED}</p>
      </section>

      <Section title="The short version">
        <ul>
          <li>There is no Web Saver server. The extension runs entirely in your browser.</li>
          <li>
            Sign-in tokens and settings are stored only in this browser&apos;s extension storage on your computer. Web
            Saver uses a public Dropbox app so you can connect with one click. That app key only identifies the
            extension to Dropbox. If you use your own Dropbox app, that key stays in this browser too. Google Drive
            uses a Google OAuth client id baked into the extension build.
          </li>
          <li>
            The developer never receives your tokens, files, or browsing activity. The only thing the developer ever
            gets is feedback you choose to send yourself.
          </li>
          <li>No analytics, no tracking, no ads, and nothing is sold or shared.</li>
          <li>
            The settings walkthrough loads from Loom while it is showing. Hiding it stops that. Loom does not receive
            your tokens or files.
          </li>
        </ul>
      </Section>

      <Section title="What is stored on your computer">
        <p>
          Everything below is kept in <code>chrome.storage.local</code>, which only this extension in this browser
          profile can read:
        </p>
        <ul>
          <li>
            <strong>Your own Dropbox app key</strong>, only if you choose to connect with an app you created instead of
            Web Saver&apos;s. Web Saver&apos;s app key is part of the extension and only identifies it to Dropbox.
          </li>
          <li>
            <strong>Dropbox sign-in tokens</strong> (access token, refresh token, expiry) and the email address of the
            connected Dropbox account.
          </li>
          <li>
            <strong>Google Drive sign-in tokens</strong> (access token, refresh token, expiry) and the email address of
            the connected Google account, when you connect Google Drive.
          </li>
          <li>
            <strong>Your preferences</strong>: save mode, folder behaviour, rename prompt, the last Dropbox and Google
            Drive folders you used, and whether you hid the settings walkthrough.
          </li>
          <li>
            <strong>Recent saves</strong>: up to the last 20 saves, with file name, the website&apos;s domain, the
            destination folder, which cloud you saved to, the time, and the result. You can clear this list at any time
            from the settings page.
          </li>
          <li>
            <strong>Temporary save state</strong>: while a review window is open, the address of the file you are
            saving. It is removed when the save finishes or the window closes.
          </li>
          <li><strong>Setup checklist</strong>: which setup steps you have ticked.</li>
        </ul>
      </Section>

      <Section title="What is sent, and to whom">
        <p>When you save a file, Web Saver only talks to these places:</p>
        <ul>
          <li>
            <strong>Dropbox</strong> (<code>www.dropbox.com</code>, <code>api.dropboxapi.com</code>,{" "}
            <code>content.dropboxapi.com</code>), to sign you in, list and create folders, and upload the files you
            choose. For public files, Web Saver may ask Dropbox to download the file directly from its address, so
            Dropbox receives that address. Dropbox handles this data under the{" "}
            <a href="https://www.dropbox.com/privacy" rel="noopener noreferrer" target="_blank">Dropbox privacy policy</a>.
          </li>
          <li>
            <strong>Google</strong> (<code>accounts.google.com</code>, <code>oauth2.googleapis.com</code>,{" "}
            <code>www.googleapis.com</code>), when you connect or save to Google Drive, to sign you in, list and create
            folders, and upload the files you choose. Google handles this data under the{" "}
            <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">
              Google privacy policy
            </a>
            .
          </li>
          <li>
            <strong>The website hosting the file</strong> you chose to save, to download it and to check its file
            type. Requests use your normal browser session for that site, exactly as if you downloaded it yourself.
          </li>
        </ul>
        <p>
          The settings page also loads a walkthrough video from Loom (<code>www.loom.com</code>) while that video is
          showing. Loom receives that request and handles it under the{" "}
          <a href="https://www.loom.com/privacy-policy" rel="noopener noreferrer" target="_blank">
            Loom privacy policy
          </a>
          . Hiding the walkthrough stops the player from loading. Web Saver does not send your Dropbox account, tokens,
          or files to Loom.
        </p>
        <p>Nothing is sent to the developer or to any other service, unless you choose to send feedback as described below.</p>
      </Section>

      <Section title="Feedback">
        <p>Sending feedback is always your choice, and you always send it yourself:</p>
        <ul>
          <li>
            <strong>Send feedback</strong> opens a GitHub issue form, or your email app, with your message filled in.
            Nothing is sent until you submit it there, and you can edit everything first.
          </li>
          <li>
            GitHub issues are public and are handled under the{" "}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub privacy statement
            </a>
            . Emails go privately to the developer, who may copy the feedback into a GitHub issue without your name or
            email address.
          </li>
          <li>
            If <strong>Include version and browser info</strong> is on, the message includes the extension version,
            your browser and operating system (for example &quot;Chrome 141 on macOS&quot;), and whether Dropbox is
            connected. It never includes a personal app key, tokens, browsing history, or saved files.
          </li>
          <li>
            <strong>Report this problem</strong> in the review window copies the error message into the form. Error
            messages can mention a file&apos;s web address, so remove anything you don&apos;t want to share before
            submitting.
          </li>
          <li>
            When you uninstall the extension, your browser opens the GitHub feedback form so you can say why. Nothing
            is sent unless you submit it, and you can simply close the tab.
          </li>
        </ul>
      </Section>

      <Section title="Why the extension needs each permission">
        <ul>
          <li><strong>storage</strong>: keep your tokens, an optional personal app key, preferences, and recent saves on your computer.</li>
          <li><strong>contextMenus</strong>: add the &quot;Save … to…&quot; items (Dropbox / Google Drive) to the right-click menu.</li>
          <li><strong>identity</strong>: open Dropbox or Google sign-in windows and receive the result securely.</li>
          <li>
            <strong>Host access to Google APIs</strong>: talk to Google for Drive sign-in, folder browsing, and uploads
            when you choose Google Drive.
          </li>
          <li>
            <strong>scripting</strong> and <strong>activeTab</strong>: only after you right-click a save action or
            click &quot;Scan this page&quot;, access the tab you are on to find files on the page, fetch a file using
            your login on that site, and show the saving notice. Access ends when you leave or close the tab.
          </li>
          <li>
            <strong>Access to a specific site (optional)</strong>: Web Saver has no standing access to websites. If a
            cloud destination can&apos;t fetch a file by itself, the extension asks you to allow that one site so it can
            download the file from your browser. You can decline, and you can remove access at any time from the
            extension&apos;s details page in Chrome.
          </li>
        </ul>
      </Section>

      <Section title="How Dropbox sign-in works">
        <p>
          Web Saver connects with OAuth and PKCE. No app secret is stored. By default it uses Web Saver&apos;s public
          Dropbox app, which only identifies the extension to Dropbox. Tokens stay in this browser, and the developer
          never receives them or your files.
        </p>
        <p>
          You can instead create a Dropbox app in your own account and paste its app key in settings. That takes about
          3 minutes. That key is stored only in this browser. Only you can manage that app, and only you can revoke it.
        </p>
        <p>
          If you connected before this change by creating your own Dropbox app, that connection stays as it is.
          Updating the extension does not move you to Web Saver&apos;s app, does not replace your tokens, and does not
          change your preferences or recent saves. Your personal app key remains only on this computer. Disconnecting
          does not delete it. Clearing that saved key signs you out; the next connect can use Web Saver&apos;s app.
        </p>
        <p>
          Web Saver requests the <code>account_info.read</code>, <code>files.metadata.read</code>,{" "}
          <code>files.metadata.write</code>, and <code>files.content.write</code> permissions. It never requests{" "}
          <code>files.content.read</code>, so it cannot read the contents of files already in your Dropbox.
        </p>
      </Section>

      <Section title="How Google Drive sign-in works">
        <p>
          Google Drive uses OAuth and PKCE with a Web application client id (and client secret required by Google&apos;s
          token endpoint). Those values identify the extension build to Google. Tokens stay in this browser, and the
          developer never receives them or your files.
        </p>
        <p>
          Web Saver requests <code>drive</code> so it can list folders already in your Drive and save files into them,
          plus <code>userinfo.email</code> to show which Google account is connected. The extension does not browse or
          download files already in Drive. You can revoke access at any time from your Google account.
        </p>
      </Section>

      <Section title="Your control">
        <ul>
          <li>
            <strong>Disconnect</strong> on the settings page signs out and revokes the extension&apos;s tokens for that
            cloud.
          </li>
          <li>
            Revoke Dropbox access at any time from{" "}
            <a href="https://www.dropbox.com/account/connected_apps" rel="noopener noreferrer" target="_blank">
              Dropbox → Settings → Connected apps
            </a>.
          </li>
          <li>
            Revoke Google Drive access from{" "}
            <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer" target="_blank">
              Google Account → Third-party access
            </a>.
          </li>
          <li>
            Delete a Dropbox app you created from the{" "}
            <a href="https://www.dropbox.com/developers/apps" rel="noopener noreferrer" target="_blank">
              Dropbox App Console
            </a>
            . Web Saver&apos;s shared app is revoked from Connected apps, not by deleting it.
          </li>
          <li><strong>Clear history</strong> on the settings page removes the recent saves list.</li>
          <li>Removing the extension deletes everything it stored in your browser.</li>
        </ul>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, the &quot;Last updated&quot; date above will change too. It applies together with the{" "}
          <a href="/terms.html">terms of service</a>. Questions: email {CONTACT_EMAIL} or{" "}
          <a href={ISSUES_URL} rel="noopener noreferrer" target="_blank">open an issue on GitHub</a>.
        </p>
        <p className="muted">
          {PRODUCT_NAME} is an independent project and is not affiliated with or endorsed by Dropbox, Inc. or
          Google.
        </p>
      </Section>
    </div>
  );
}
