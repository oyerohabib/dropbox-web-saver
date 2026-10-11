import { useEffect, useState, type ReactNode } from "react";
import { sendBackgroundMessage } from "../lib/browser";
import { DROPBOX_SCOPES } from "../lib/constants";
import { getSetupProgress, setSetupProgress } from "../lib/storage";
import type { DropboxAuthState, ExtensionSettings, SetupProgress } from "../lib/types";
import { getSetupErrorHint, isLikelyAppKey, maskAppKey, type SetupStepNumber } from "../lib/utils/app-key";
import { Button, CopyField, Skeleton, StatusMessage } from "./ui";

const CREATE_APP_URL = "https://www.dropbox.com/developers/apps/create";
const MY_APPS_URL = "https://www.dropbox.com/developers/apps";

interface SetupWizardProps {
  authState: DropboxAuthState | null;
  appKey: string | null;
  onChange: () => Promise<void> | void;
}

interface StepDefinition {
  number: SetupStepNumber;
  title: string;
  done: boolean;
  body: ReactNode;
}

export function PrivacyBanner() {
  return (
    <div className="privacy-banner">
      <span aria-hidden="true" className="privacy-banner-icon">🔒</span>
      <div className="stack-sm">
        <strong>Your key stays on this computer</strong>
        <span>
          The app key and the sign-in tokens Dropbox gives you are stored only in this browser&apos;s extension
          storage. There is no Web Saver server. Files go from the web page or Dropbox straight into your Dropbox.
          The developer never sees your key, tokens, or files.
        </span>
        <a href="/privacy.html" rel="noopener" target="_blank">Read the privacy policy</a>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="secondary-button" href={href} rel="noopener noreferrer" target="_blank">
      {children} ↗
    </a>
  );
}

function ManualCheck({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="row step-check">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>I&apos;ve done this</span>
    </label>
  );
}

export function SetupWizard({ authState, appKey, onChange }: SetupWizardProps) {
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [openStep, setOpenStep] = useState<SetupStepNumber | "none" | null>(null);
  const [appKeyDraft, setAppKeyDraft] = useState(appKey ?? "");
  const [editingKey, setEditingKey] = useState(!appKey);
  const [savingKey, setSavingKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<{ message: string; hint: string; step: SetupStepNumber | null } | null>(null);

  useEffect(() => {
    void getSetupProgress().then(setProgress);
  }, []);

  useEffect(() => {
    setAppKeyDraft(appKey ?? "");
    setEditingKey(!appKey);
  }, [appKey]);

  if (!progress || !authState) return <Skeleton rows={5} />;

  const signedIn = authState.status === "signed_in";

  async function updateProgress(patch: Partial<SetupProgress>) {
    setProgress(await setSetupProgress(patch));
  }

  async function saveAppKey() {
    setSavingKey(true);
    setError(null);
    try {
      await sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: { appKey: appKeyDraft.trim() || null },
      });
      setEditingKey(false);
      setOpenStep(5);
      await onChange();
    } catch (saveError) {
      setError({
        message: saveError instanceof Error ? saveError.message : "Could not save the app key.",
        hint: "Try saving the key again.",
        step: 4,
      });
    } finally {
      setSavingKey(false);
    }
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
      await onChange();
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : "Dropbox connection failed.";
      setError({ message, ...getSetupErrorHint(message) });
    } finally {
      setConnecting(false);
    }
  }

  const trimmedDraft = appKeyDraft.trim();
  const showKeyHint = trimmedDraft.length > 0 && !isLikelyAppKey(trimmedDraft);

  const steps: StepDefinition[] = [
    {
      number: 1,
      title: "Create your Dropbox app",
      done: progress.createdApp || signedIn,
      body: (
        <>
          <ExternalLink href={CREATE_APP_URL}>Open the Dropbox App Console</ExternalLink>
          <ol className="step-instructions">
            <li>Choose <strong>Scoped access</strong>.</li>
            <li>Choose <strong>Full Dropbox</strong>.</li>
            <li>Give the app any unique name, for example <em>Web Saver - yourname</em>.</li>
            <li>Click <strong>Create app</strong>.</li>
          </ol>
          <p className="muted">This app lives in your own Dropbox account. Only you can see or use it.</p>
          <ManualCheck checked={progress.createdApp} onChange={(checked) => void updateProgress({ createdApp: checked })} />
        </>
      ),
    },
    {
      number: 2,
      title: "Turn on permissions",
      done: progress.enabledScopes || signedIn,
      body: (
        <>
          <p>
            In your app, open the <strong>Permissions</strong> tab, tick these four boxes, then click{" "}
            <strong>Submit</strong> at the bottom of the page.
          </p>
          <ul className="scope-list">
            {DROPBOX_SCOPES.map((scope) => (
              <li key={scope}><code>{scope}</code></li>
            ))}
          </ul>
          <p className="muted">
            Web Saver never asks for <code>files.content.read</code>, so it can add files to your Dropbox but cannot
            read the files already there.
          </p>
          <ManualCheck
            checked={progress.enabledScopes}
            onChange={(checked) => void updateProgress({ enabledScopes: checked })}
          />
        </>
      ),
    },
    {
      number: 3,
      title: "Add the redirect URI",
      done: progress.addedRedirectUri || signedIn,
      body: (
        <>
          <p>
            Open the <strong>Settings</strong> tab of your app. Under <strong>OAuth 2 → Redirect URIs</strong>, paste
            this address and click <strong>Add</strong>.
          </p>
          <CopyField value={authState.redirectUri} />
          <p className="muted">
            This address only works inside your browser. It is how Dropbox hands the sign-in back to this extension.
          </p>
          <ManualCheck
            checked={progress.addedRedirectUri}
            onChange={(checked) => void updateProgress({ addedRedirectUri: checked })}
          />
        </>
      ),
    },
    {
      number: 4,
      title: "Paste your App key",
      done: Boolean(appKey),
      body: (
        <>
          <p>
            On the same <strong>Settings</strong> tab, copy the value next to <strong>App key</strong> and paste it
            here.
          </p>
          <StatusMessage tone="warning">
            Do not paste the <strong>App secret</strong>. Web Saver uses secure sign-in (PKCE) and never needs it.
          </StatusMessage>
          {editingKey ? (
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                void saveAppKey();
              }}
            >
              <input
                aria-label="Dropbox app key"
                autoComplete="off"
                className="text-input"
                onChange={(event) => setAppKeyDraft(event.target.value)}
                placeholder="e.g. abc123xyz456def"
                spellCheck={false}
                value={appKeyDraft}
              />
              <Button disabled={!trimmedDraft} loading={savingKey} type="submit">
                Save key
              </Button>
            </form>
          ) : (
            <div className="row row-between">
              <span className="row">
                <span className="muted">Saved key</span>
                <span className="path-pill">{maskAppKey(appKey ?? "")}</span>
              </span>
              <Button onClick={() => setEditingKey(true)} variant="ghost">Change</Button>
            </div>
          )}
          {editingKey && showKeyHint ? (
            <span className="muted">
              That doesn&apos;t look like a Dropbox app key. Keys are usually 15 lowercase letters and numbers with
              no spaces.
            </span>
          ) : null}
          {editingKey && appKey ? (
            <span className="muted">Changing the key signs you out of Dropbox.</span>
          ) : null}
        </>
      ),
    },
    {
      number: 5,
      title: "Connect Dropbox",
      done: signedIn,
      body: signedIn ? (
        <StatusMessage tone="success">
          Connected{authState.accountEmail ? ` as ${authState.accountEmail}` : ""}. You&apos;re ready to save.
        </StatusMessage>
      ) : (
        <>
          <p>
            A Dropbox window opens. Sign in if asked, then click <strong>Allow</strong>.
          </p>
          <div>
            <Button disabled={!appKey} large loading={connecting} onClick={() => void connect()}>
              Connect Dropbox
            </Button>
          </div>
          {!appKey ? <span className="muted">Save your app key in step 4 first.</span> : null}
        </>
      ),
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  const currentStep = steps.find((step) => !step.done)?.number ?? null;
  const expandedStep = openStep === "none" ? null : openStep ?? currentStep;

  return (
    <div className="stack">
      <PrivacyBanner />

      <div className="row row-between">
        <span className="muted">
          {completed === steps.length ? "All set" : `${completed} of ${steps.length} steps done · about 3 minutes`}
        </span>
        <a className="muted" href={MY_APPS_URL} rel="noopener noreferrer" target="_blank">My Dropbox apps ↗</a>
      </div>
      <div aria-hidden="true" className="progress-track">
        <div className="progress-fill" style={{ width: `${(completed / steps.length) * 100}%` }} />
      </div>

      {error ? (
        <StatusMessage tone="error">
          <div className="stack-sm">
            <strong>{error.message}</strong>
            <span>{error.hint}</span>
            {error.step ? (
              <button className="link-button" onClick={() => setOpenStep(error.step)} type="button">
                Go to step {error.step}
              </button>
            ) : null}
          </div>
        </StatusMessage>
      ) : null}

      <ol className="stepper">
        {steps.map((step) => {
          const isOpen = expandedStep === step.number;
          const status = step.done ? "done" : step.number === currentStep ? "current" : "upcoming";
          return (
            <li className={`step ${status}`} key={step.number}>
              <button
                aria-expanded={isOpen}
                className="step-header"
                onClick={() => setOpenStep(isOpen ? "none" : step.number)}
                type="button"
              >
                <span aria-hidden="true" className="step-marker">{step.done ? "✓" : step.number}</span>
                <span className="step-title">{step.title}</span>
                <span className="muted">{isOpen ? "Hide" : step.done ? "Done" : "Show"}</span>
              </button>
              {isOpen ? <div className="step-body stack">{step.body}</div> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
