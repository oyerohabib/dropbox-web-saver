import { useEffect, useState } from "react";
import { PreferencesForm } from "../../components/PreferencesForm";
import { RecentSaves } from "../../components/RecentSaves";
import { SetupWizard } from "../../components/SetupWizard";
import { Button, CopyField, Skeleton, StatusMessage, type StatusTone } from "../../components/ui";
import { sendBackgroundMessage } from "../../lib/browser";
import { REPO_URL } from "../../lib/project";
import { maskAppKey } from "../../lib/utils/app-key";
import { SUPPORTED_FILE_TYPES } from "../../lib/utils/file-types";
import type {
  DropboxAuthState,
  ExtensionSettings,
  RecentSaveRecord,
} from "../../lib/types";

type BusyAction = "disconnect";

export function OptionsApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [showGuide, setShowGuide] = useState(window.location.hash === "#setup");
  const [message, setMessage] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);

  async function load() {
    const [nextAuthState, nextSettings, nextRecentSaves] = await Promise.all([
      sendBackgroundMessage<DropboxAuthState>({ type: "GET_AUTH_STATE" }),
      sendBackgroundMessage<ExtensionSettings>({ type: "GET_SETTINGS" }),
      sendBackgroundMessage<RecentSaveRecord[]>({ type: "GET_RECENT_SAVES" }),
    ]);
    setAuthState(nextAuthState);
    setSettings(nextSettings);
    setRecentSaves(nextRecentSaves);
  }

  useEffect(() => {
    void load().then(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || !preferencesReady || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loaded, preferencesReady]);

  async function runAction(action: BusyAction, task: () => Promise<unknown>, success: string, failure: string) {
    setBusyAction(action);
    setMessage(null);
    try {
      await task();
      setMessage({ tone: "success", text: success });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : failure });
    } finally {
      setBusyAction(null);
    }
  }

  function disconnect() {
    return runAction(
      "disconnect",
      () => sendBackgroundMessage<{ ok: true }>({ type: "DISCONNECT_DROPBOX" }),
      "Dropbox disconnected.",
      "Could not disconnect Dropbox.",
    );
  }

  async function clearHistory() {
    if (!window.confirm("Clear your recent saves history? Files already in Dropbox are not affected.")) return;
    setClearingHistory(true);
    try {
      await sendBackgroundMessage<{ ok: true }>({ type: "CLEAR_RECENT_SAVES" });
      setRecentSaves([]);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not clear history." });
    } finally {
      setClearingHistory(false);
    }
  }

  const signedIn = authState?.status === "signed_in";

  const setupSection = (
    <section className="panel" id="setup">
      <div className="panel-header">
        <div>
          <div className="section-title">Set up Dropbox</div>
          <div className="muted">
            Web Saver connects through a small Dropbox app that you create in your own account.
          </div>
        </div>
      </div>
      <SetupWizard appKey={settings?.appKey ?? null} authState={authState} onChange={load} />
    </section>
  );

  return (
    <div className="app-shell page">
      <section className="hero">
        <div className="row" style={{ gap: 12 }}>
          <img alt="" src="/icons/48.png" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <div className="eyebrow">Web Saver for Dropbox</div>
            <h1>Settings</h1>
          </div>
        </div>
        <p>
          {authState && !signedIn
            ? "Finish the short setup below to start saving to Dropbox. Everything stays in this browser."
            : "Choose how saving works, manage your Dropbox connection, and review recent saves."}
        </p>
      </section>

      <nav aria-label="Settings sections" className="page-nav">
        {authState && !signedIn ? <a href="#setup">Setup</a> : null}
        <a href="#preferences">Save preferences</a>
        {signedIn ? <a href="#connection">Dropbox connection</a> : null}
        <a href="#supported-files">Supported files</a>
        <a href="#recent-saves">Recent saves</a>
      </nav>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

      {!authState ? <Skeleton rows={4} /> : null}

      {authState && !signedIn ? setupSection : null}

      <section className="panel" id="preferences">
        <div className="panel-header">
          <div>
            <div className="section-title">Save preferences</div>
            <div className="muted">Changes save automatically.</div>
          </div>
        </div>
        <PreferencesForm
          onChooseFolder={() => void sendBackgroundMessage({ type: "OPEN_FOLDER_SETTINGS" })}
          onReady={() => setPreferencesReady(true)}
          variant="full"
        />
      </section>

      {signedIn && authState ? (
        <div className="options-grid" id="connection">
          <section className="panel stack">
            <div className="row row-between">
              <div className="section-title">Dropbox connection</div>
              <span className="badge success">
                <span className="status-dot" />
                Connected
              </span>
            </div>
            <div className="muted break-anywhere">
              Signed in{authState.accountEmail ? ` as ${authState.accountEmail}` : ""}.
            </div>
            <div className="actions-wrap">
              <Button loading={busyAction === "disconnect"} onClick={() => void disconnect()} variant="ghost">
                Disconnect
              </Button>
            </div>
          </section>

          <section className="panel stack" id="dropbox-app">
            <div className="section-title">Your Dropbox app</div>
            <div className="row row-between">
              <span className="row">
                <span className="muted">App key</span>
                <span className="path-pill">{maskAppKey(settings?.appKey ?? "")}</span>
              </span>
              <Button onClick={() => setShowGuide(true)} variant="ghost">Change</Button>
            </div>
            <div className="field">
              <span className="field-label">Redirect URI</span>
              <CopyField value={authState.redirectUri} />
            </div>
            <span className="muted">Stored only in this browser. Never sent to Web Saver.</span>
            <button className="link-button" onClick={() => setShowGuide((current) => !current)} type="button">
              {showGuide ? "Hide setup guide" : "Show setup guide"}
            </button>
          </section>
        </div>
      ) : null}

      {signedIn && showGuide ? setupSection : null}

      <section className="panel stack" id="supported-files">
        <div>
          <div className="section-title">Supported files</div>
          <div className="muted">
            Right-click any image, video, or audio on a page to save it, whatever its format. Links and page scans
            recognise these file types:
          </div>
        </div>
        <dl className="file-types">
          {SUPPORTED_FILE_TYPES.map((group) => (
            <div className="file-types-row" key={group.label}>
              <dt>{group.label}</dt>
              <dd>{group.extensions.join(", ")}</dd>
            </div>
          ))}
        </dl>
        <div className="muted">
          Links to other files still work when the site serves them as a download. Streamed video (such as YouTube)
          can&apos;t be saved.
        </div>
      </section>

      <div id="recent-saves" style={{ scrollMarginTop: 16 }}>
        <RecentSaves
          clearing={clearingHistory}
          items={recentSaves}
          onClear={() => void clearHistory()}
        />
      </div>

      <footer className="muted page-footer">
        Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc.
        {" · "}
        <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
        <div className="actions-wrap footer-links">
          <a href="/feedback.html" rel="noopener" target="_blank">Send feedback</a>
          <a href="/feedback.html?kind=bug" rel="noopener" target="_blank">Report a bug</a>
          <a href={REPO_URL} rel="noopener noreferrer" target="_blank">Source on GitHub</a>
        </div>
      </footer>
    </div>
  );
}
