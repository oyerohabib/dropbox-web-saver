import type { ReactNode } from "react";
import { CONTACT_EMAIL, ISSUES_URL } from "../../lib/project";

const LAST_UPDATED = "October 11, 2026";

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
            <div className="eyebrow">Web Saver for Dropbox</div>
            <h1>Privacy policy</h1>
          </div>
        </div>
        <p>Last updated {LAST_UPDATED}</p>
      </section>

      <Section title="The short version">
        <ul>
          <li>There is no Web Saver server. The extension runs entirely in your browser.</li>
          <li>
            Your Dropbox app key, sign-in tokens, and settings are stored only in this browser&apos;s extension
            storage on your computer.
          </li>
          <li>
            The developer never receives your app key, tokens, files, or browsing activity. The only thing the developer
            ever gets is feedback you choose to send yourself.
          </li>
          <li>No analytics, no tracking, no ads, and nothing is sold or shared.</li>
        </ul>
      </Section>

      <Section title="What is stored on your computer">
        <p>
          Everything below is kept in <code>chrome.storage.local</code>, which only this extension in this browser
          profile can read:
        </p>
        <ul>
          <li>
            <strong>Your Dropbox app key</strong>, which identifies the Dropbox app you created in your own account.
          </li>
          <li>
            <strong>Dropbox sign-in tokens</strong> (access token, refresh token, expiry) and the email address of the
            connected Dropbox account.
          </li>
          <li>
            <strong>Your preferences</strong>: save mode, folder behaviour, rename prompt, and the last folder you used.
          </li>
          <li>
            <strong>Recent saves</strong>: up to the last 20 saves, with file name, the website&apos;s domain, the
            destination folder, the time, and the result. You can clear this list at any time from the settings
            page.
          </li>
          <li>
            <strong>Temporary save state</strong>: while a review window is open, the address of the file you are
            saving. It is removed when the save finishes or the window closes.
          </li>
          <li><strong>Setup checklist</strong>: which setup steps you have ticked.</li>
        </ul>
      </Section>

      <Section title="What is sent, and to whom">
        <p>Web Saver only talks to two kinds of places, and only when you ask it to save something:</p>
        <ul>
          <li>
            <strong>Dropbox</strong> (<code>www.dropbox.com</code>, <code>api.dropboxapi.com</code>,{" "}
            <code>content.dropboxapi.com</code>), to sign you in, list and create folders, and upload the files you
            choose. For public files, Web Saver may ask Dropbox to download the file directly from its address, so
            Dropbox receives that address. Dropbox handles this data under the{" "}
            <a href="https://www.dropbox.com/privacy" rel="noopener noreferrer" target="_blank">Dropbox privacy policy</a>.
          </li>
          <li>
            <strong>The website hosting the file</strong> you chose to save, to download it and to check its file
            type. Requests use your normal browser session for that site, exactly as if you downloaded it yourself.
          </li>
        </ul>
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
            connected. It never includes your app key, tokens, browsing history, or saved files.
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
          <li><strong>storage</strong>: keep your app key, tokens, preferences, and recent saves on your computer.</li>
          <li><strong>contextMenus</strong>: add the &quot;Save … to Dropbox&quot; items to the right-click menu.</li>
          <li><strong>identity</strong>: open Dropbox&apos;s own sign-in window and receive the result securely.</li>
          <li>
            <strong>scripting</strong> and <strong>activeTab</strong>: only after you right-click &quot;Save … to
            Dropbox&quot; or click &quot;Scan this page&quot;, access the tab you are on to find files on the page,
            fetch a file using your login on that site, and show the saving notice. Access ends when you leave or
            close the tab.
          </li>
          <li>
            <strong>Access to a specific site (optional)</strong>: Web Saver has no standing access to websites. If
            Dropbox can&apos;t fetch a file by itself, the extension asks you to allow that one site so it can download
            the file from your browser. You can decline, and you can remove access at any time from the
            extension&apos;s details page in Chrome.
          </li>
        </ul>
      </Section>

      <Section title="Why you create your own Dropbox app">
        <p>
          Instead of routing everyone through a shared app owned by the developer, Web Saver connects through a Dropbox
          app that you create in your own account. Only you can see or manage it, and only you can revoke it. Sign-in
          uses OAuth with PKCE, so no app secret is ever needed or stored.
        </p>
        <p>
          Web Saver requests the <code>account_info.read</code>, <code>files.metadata.read</code>,{" "}
          <code>files.metadata.write</code>, and <code>files.content.write</code> permissions. It never requests{" "}
          <code>files.content.read</code>, so it cannot read the contents of files already in your Dropbox.
        </p>
      </Section>

      <Section title="Your control">
        <ul>
          <li>
            <strong>Disconnect</strong> on the settings page signs out and revokes the extension&apos;s tokens.
          </li>
          <li>
            Revoke access at any time from{" "}
            <a href="https://www.dropbox.com/account/connected_apps" rel="noopener noreferrer" target="_blank">
              Dropbox → Settings → Connected apps
            </a>.
          </li>
          <li>
            Delete your Dropbox app from the{" "}
            <a href="https://www.dropbox.com/developers/apps" rel="noopener noreferrer" target="_blank">
              Dropbox App Console
            </a>.
          </li>
          <li><strong>Clear history</strong> on the settings page removes the recent saves list.</li>
          <li>Removing the extension deletes everything it stored in your browser.</li>
        </ul>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, the &quot;Last updated&quot; date above will change too. Questions: email {CONTACT_EMAIL} or{" "}
          <a href={ISSUES_URL} rel="noopener noreferrer" target="_blank">open an issue on GitHub</a>.
        </p>
        <p className="muted">
          Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc.
        </p>
      </Section>
    </div>
  );
}
