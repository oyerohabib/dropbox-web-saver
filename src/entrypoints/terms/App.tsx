import type { ReactNode } from "react";
import { ISSUES_URL, PRODUCT_NAME, REPO_URL } from "../../lib/project";

const TERMS_CONTACT_EMAIL = "hello@oyerohabib.com";

const LAST_UPDATED = "November 26, 2026";
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel stack policy-section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export function TermsApp() {
  return (
    <div className="app-shell page policy">
      <section className="hero">
        <div className="row" style={{ gap: 12 }}>
          <img alt="" src="/icons/48.png" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <div className="eyebrow">{PRODUCT_NAME}</div>
            <h1>Terms of service</h1>
          </div>
        </div>
        <p>Last updated {LAST_UPDATED}</p>
      </section>

      <Section title="The short version">
        <ul>
          <li>
            {PRODUCT_NAME} (&quot;Web Saver&quot;) is a free browser extension. It saves images, videos, audio, and
            files you choose from a web page into your own Dropbox or Google Drive.
          </li>
          <li>
            There is no Web Saver account and no Web Saver server. Installing or using the extension means you agree
            to these terms and the <a href="/privacy.html">privacy policy</a>.
          </li>
          <li>You choose every file. You are responsible for having the right to save it.</li>
          <li>Dropbox, Google, and the sites you save from are separate services with their own terms.</li>
          <li>The extension is free and is provided as is.</li>
        </ul>
      </Section>

      <Section title="Who provides it">
        <p>
          Web Saver is an independent project. It is not affiliated with or endorsed by Dropbox, Inc. or Google, and it
          does not use their logos.
        </p>
        <p>
          These terms cover the published extension. The source code is on{" "}
          <a href={REPO_URL} rel="noopener noreferrer" target="_blank">GitHub</a> under the{" "}
          <a href={LICENSE_URL} rel="noopener noreferrer" target="_blank">MIT License</a>. That license covers the
          code. These terms cover using the extension in your browser.
        </p>
      </Section>

      <Section title="What the extension does">
        <p>Web Saver saves a file you can already see or open on a page:</p>
        <ul>
          <li>Right-click an image, video, audio item, or file link, or scan the page and pick files.</li>
          <li>Choose Dropbox, Google Drive, or both, and a folder in that account.</li>
          <li>The file is uploaded to the account you connected.</li>
        </ul>
        <p>
          Web Saver does not host your files or keep a copy. A public file may be fetched by Dropbox from its address.
          Other files are downloaded in your browser, using the login you already have on that site, and then uploaded.
          What is stored and sent is described in the <a href="/privacy.html">privacy policy</a>.
        </p>
      </Section>

      <Section title="Your accounts">
        <p>
          You use your own Dropbox account, Google account, or both. Connecting asks that service for permission to
          list and create folders and to save the files you choose. The permissions requested are listed in the privacy
          policy.
        </p>
        <p>
          You can disconnect from the settings page at any time, and you can revoke Web Saver from your Dropbox or
          Google account. Disconnecting does not delete files already saved.
        </p>
        <p>
          By default, Dropbox sign-in uses Web Saver&apos;s public Dropbox app, which only identifies the extension to
          Dropbox. You can instead connect with a Dropbox app you create. That app is yours. You follow Dropbox&apos;s
          rules for it, and only you can manage or delete it.
        </p>
        <p>
          Google Drive sign-in uses the Google OAuth client shipped with the extension. Google&apos;s terms apply to
          your Google account and to files in Drive.
        </p>
      </Section>

      <Section title="Files you save">
        <p>
          You decide what to save. Save only files you have the right to copy, including the rules of the website,
          copyright, and the terms of any account you are signed into.
        </p>
        <p>
          Saving uses your normal browser session on that site, the same way a download you start yourself would. Web
          Saver does not open anything you cannot already open.
        </p>
        <p>
          Files you save are stored by Dropbox or Google in the folder you pick. Those companies&apos; terms cover the
          files once they are in your account. Web Saver cannot read files already in your Dropbox, and it does not
          browse or download files already in your Drive.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>Use Web Saver for your own saves. Do not use it to:</p>
        <ul>
          <li>copy content you are not allowed to keep</li>
          <li>break the law</li>
          <li>interfere with Dropbox, Google, or someone else&apos;s account</li>
          <li>share or resell Web Saver&apos;s Dropbox app key, or present that app as your own</li>
        </ul>
      </Section>

      <Section title="Other services">
        <p>Saving and sign-in depend on services Web Saver does not control:</p>
        <ul>
          <li>
            <strong>Dropbox</strong>, under the{" "}
            <a href="https://www.dropbox.com/terms" rel="noopener noreferrer" target="_blank">
              Dropbox Terms of Service
            </a>
          </li>
          <li>
            <strong>Google</strong>, under the{" "}
            <a href="https://policies.google.com/terms" rel="noopener noreferrer" target="_blank">
              Google Terms of Service
            </a>
          </li>
          <li>
            <strong>The website hosting the file</strong>, under that site&apos;s own terms
          </li>
          <li>
            <strong>Loom</strong>, only while the settings walkthrough is showing
          </li>
          <li>
            <strong>GitHub</strong> or email, only when you choose to send feedback
          </li>
        </ul>
        <p>
          If one of those services is unavailable or refuses a request, the save can fail. Web Saver shows the error it
          received.
        </p>
      </Section>

      <Section title="Privacy">
        <p>
          What the extension stores, and where data goes, is in the <a href="/privacy.html">privacy policy</a>. These
          terms and the privacy policy apply together. If they ever differ about personal data, the privacy policy is
          the one that applies.
        </p>
      </Section>

      <Section title="No charge, and no warranty">
        <p>
          Web Saver is free. It is provided as is and as available. A save may fail, a folder may no longer exist,
          Dropbox or Google may change, and the extension may have errors or be unavailable.
        </p>
        <p>
          The developer may change, pause, or stop offering the extension. Uninstalling it removes what it stored in
          your browser. Files already in Dropbox or Google Drive stay there until you delete them.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          To the extent the law allows, the developer is not liable for lost files, failed or incomplete saves, or for
          what Dropbox, Google, or a website does with your account or content. These terms do not limit liability that
          the law does not allow to be limited.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If these terms change, the &quot;Last updated&quot; date above will change too. Keeping the extension
          installed after that date means you accept the updated terms. If you do not agree, disconnect your accounts
          and remove the extension.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions: email {TERMS_CONTACT_EMAIL} or{" "}
          <a href={ISSUES_URL} rel="noopener noreferrer" target="_blank">open an issue on GitHub</a>.
        </p>
        <p className="muted">
          {PRODUCT_NAME} is an independent project and is not affiliated with or endorsed by Dropbox, Inc. or Google.
        </p>
      </Section>
    </div>
  );
}
