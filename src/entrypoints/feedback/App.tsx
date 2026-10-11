import { useEffect, useMemo, useState } from "react";
import { Button, SegmentedControl, StatusMessage, Toggle } from "../../components/ui";
import { sendBackgroundMessage } from "../../lib/browser";
import {
  buildFeedbackEmail,
  buildIssueUrl,
  describeBrowser,
  FEEDBACK_KINDS,
  formatEnvironment,
  isFeedbackKind,
  ISSUES_URL,
  MAX_EMAIL_DESCRIPTION_LENGTH,
  type FeedbackKind,
} from "../../lib/project";
import type { DropboxAuthState } from "../../lib/types";

const KIND_OPTIONS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature idea" },
  { value: "feedback", label: "Other feedback" },
];

const PLACEHOLDERS: Record<FeedbackKind, { title: string; description: string }> = {
  bug: {
    title: "Saving a video from a news site fails",
    description: "What happened, what you expected, and the steps to make it happen again.",
  },
  feature: {
    title: "Save a whole page as PDF",
    description: "What you'd like, and what you're trying to do that it would help with.",
  },
  feedback: {
    title: "The setup guide was confusing at step 3",
    description: "What you like, what's confusing, or anything else on your mind.",
  },
};

type Sent = "github" | "email" | null;

function readPrefill() {
  const params = new URLSearchParams(location.search);
  const kind = params.get("kind");
  return {
    kind: isFeedbackKind(kind) ? kind : "bug",
    title: params.get("title") ?? "",
    message: params.get("message") ?? "",
  };
}

export function FeedbackApp() {
  const prefill = useMemo(readPrefill, []);
  const [kind, setKind] = useState<FeedbackKind>(prefill.kind);
  const [title, setTitle] = useState(prefill.title);
  const [description, setDescription] = useState(prefill.message);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sent, setSent] = useState<Sent>(null);

  useEffect(() => {
    sendBackgroundMessage<DropboxAuthState>({ type: "GET_AUTH_STATE" })
      .then((state) => setConnected(state.status === "signed_in"))
      .catch(() => setConnected(false));
  }, []);

  const diagnostics = useMemo(
    () => ({
      version: chrome.runtime.getManifest().version,
      browser: describeBrowser(navigator.userAgent),
      connected,
    }),
    [connected],
  );

  const input = { kind, title, description, includeDiagnostics, diagnostics };
  const acceptsDiagnostics = FEEDBACK_KINDS[kind].acceptsDiagnostics;
  const canSend = description.trim().length > 0;

  return (
    <div className="app-shell page narrow">
      <section className="hero">
        <div className="row" style={{ gap: 12 }}>
          <img alt="" src="/icons/48.png" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <div className="eyebrow">Web Saver for Dropbox</div>
            <h1>Send feedback</h1>
          </div>
        </div>
        <p>
          Report a bug, suggest an idea, or tell us what you think. Every message becomes a GitHub issue so you can
          follow it until it&apos;s resolved.
        </p>
      </section>

      <form
        className="panel stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSend) return;
          void chrome.tabs.create({ url: buildIssueUrl(input) });
          setSent("github");
        }}
      >
        <SegmentedControl label="What kind of feedback?" onChange={setKind} options={KIND_OPTIONS} value={kind} />

        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="text-input"
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={PLACEHOLDERS[kind].title}
            value={title}
          />
        </label>

        <label className="field">
          <span className="field-label">Details</span>
          <textarea
            className="text-input text-area"
            onChange={(event) => setDescription(event.target.value)}
            placeholder={PLACEHOLDERS[kind].description}
            required
            value={description}
          />
          {description.length > MAX_EMAIL_DESCRIPTION_LENGTH ? (
            <span className="muted">Long messages are shortened in the link. You can paste the rest before sending.</span>
          ) : null}
        </label>

        {acceptsDiagnostics ? (
          <div className="stack-sm">
            <Toggle
              checked={includeDiagnostics}
              description="Helps reproduce problems. Never includes your app key, tokens, pages, or files."
              label="Include version and browser info"
              onChange={setIncludeDiagnostics}
            />
            {includeDiagnostics ? (
              <ul className="diagnostics-preview muted">
                <li>Extension version: {diagnostics.version}</li>
                <li>Browser and environment: {formatEnvironment(diagnostics)}</li>
              </ul>
            ) : null}
          </div>
        ) : null}

        {sent === "github" ? (
          <StatusMessage tone="success">
            GitHub opened in a new tab. Check the details, then submit the issue to send it.
          </StatusMessage>
        ) : null}
        {sent === "email" ? (
          <StatusMessage tone="success">Your email app should open with the message ready to send.</StatusMessage>
        ) : null}

        <div className="stack-sm">
          <div className="actions-wrap">
            <Button disabled={!canSend} large type="submit">
              Continue on GitHub
            </Button>
            <Button
              disabled={!canSend}
              onClick={() => {
                window.location.href = buildFeedbackEmail(input);
                setSent("email");
              }}
              variant="secondary"
            >
              No GitHub account? Email instead
            </Button>
          </div>
          <span className="muted">
            GitHub needs a free account and issues there are public. Emails go privately to the developer, who turns
            them into issues.
          </span>
        </div>
      </form>

      <div className="privacy-banner">
        <span aria-hidden="true" className="privacy-banner-icon">🔒</span>
        <span>
          Nothing is sent until you submit it on GitHub or in your email app.{" "}
          <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
        </span>
      </div>

      <footer className="muted page-footer">
        <a href={ISSUES_URL} rel="noopener noreferrer" target="_blank">Browse existing issues</a>
        {" · "}
        <a href="/options.html">Settings</a>
      </footer>
    </div>
  );
}
