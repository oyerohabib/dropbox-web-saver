import { useEffect, useState } from "react";
import { PreferencesForm } from "../../components/PreferencesForm";
import { RecentSaves } from "../../components/RecentSaves";
import { Button, CopyField, Skeleton, StatusMessage, type StatusTone } from "../../components/ui";
import { sendBackgroundMessage } from "../../lib/browser";
import type {
  DropboxAuthState,
  ExtensionSettings,
  RecentSaveRecord,
} from "../../lib/types";

type BusyAction = "appKey" | "connect" | "disconnect";

export function OptionsApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [appKeyDraft, setAppKeyDraft] = useState("");
  const [message, setMessage] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);

  async function load() {
    const [nextAuthState, nextSettings, nextRecentSaves] = await Promise.all([
      sendBackgroundMessage<DropboxAuthState>({ type: "GET_AUTH_STATE" }),
      sendBackgroundMessage<ExtensionSettings>({ type: "GET_SETTINGS" }),
      sendBackgroundMessage<RecentSaveRecord[]>({ type: "GET_RECENT_SAVES" }),
    ]);
    setAuthState(nextAuthState);
    setSettings(nextSettings);
    setAppKeyDraft(nextSettings.appKey || "");
    setRecentSaves(nextRecentSaves);
  }

  useEffect(() => {
    void load().then(() => {
      const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      target?.scrollIntoView({ block: "start" });
    });
  }, []);

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

  function saveAppKey() {
    return runAction(
      "appKey",
      () => sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: { appKey: appKeyDraft.trim() || null },
      }),
      "Dropbox app key saved.",
      "Could not save the Dropbox app key.",
    );
  }

  function connect() {
    return runAction(
      "connect",
      () => sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" }),
      "Dropbox connected.",
      "Dropbox connection failed.",
    );
  }

  function disconnect() {
    return runAction(
      "disconnect",
      () => sendBackgroundMessage<{ ok: true }>({ type: "DISCONNECT_DROPBOX" }),
      "Dropbox disconnected.",
      "Could not disconnect Dropbox.",
    );
  }

  const signedIn = authState?.status === "signed_in";

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
        <p>Choose how saving works, connect your Dropbox account, and review recent saves.</p>
      </section>

      <nav aria-label="Settings sections" className="page-nav">
        <a href="#preferences">Save preferences</a>
        <a href="#connection">Dropbox connection</a>
        <a href="#recent-saves">Recent saves</a>
      </nav>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

      <section className="panel" id="preferences">
        <div className="panel-header">
          <div>
            <div className="section-title">Save preferences</div>
            <div className="muted">Changes save automatically.</div>
          </div>
        </div>
        <PreferencesForm
          onChooseFolder={() => void sendBackgroundMessage({ type: "OPEN_FOLDER_SETTINGS" })}
          variant="full"
        />
      </section>

      <div className="options-grid" id="connection">
        <section className="panel stack">
          <div className="row row-between">
            <div className="section-title">Dropbox connection</div>
            {authState ? (
              <span className={`badge ${signedIn ? "success" : "neutral"}`}>
                <span className="status-dot" />
                {signedIn ? "Connected" : "Not connected"}
              </span>
            ) : null}
          </div>
          <div className="muted break-anywhere">
            {signedIn
              ? `Signed in${authState?.accountEmail ? ` as ${authState.accountEmail}` : ""}.`
              : authState?.status === "missing_app_key"
                ? "Add your Dropbox app key first, then connect."
                : "Connect your Dropbox account to start saving."}
          </div>
          <div className="actions-wrap">
            {signedIn ? (
              <Button loading={busyAction === "disconnect"} onClick={() => void disconnect()} variant="ghost">
                Disconnect
              </Button>
            ) : (
              <Button
                disabled={!settings?.appKey}
                loading={busyAction === "connect"}
                onClick={() => void connect()}
              >
                Connect Dropbox
              </Button>
            )}
          </div>
        </section>

        <section className="panel stack" id="dropbox-app">
          <div className="section-title">Dropbox app</div>
          <label className="field">
            <span className="field-label">App key</span>
            <input
              className="text-input"
              onChange={(event) => setAppKeyDraft(event.target.value)}
              placeholder="Paste your Dropbox app key"
              value={appKeyDraft}
            />
          </label>
          <Button
            disabled={appKeyDraft.trim() === (settings?.appKey ?? "")}
            loading={busyAction === "appKey"}
            onClick={() => void saveAppKey()}
          >
            Save App Key
          </Button>
          <div className="field">
            <span className="field-label">Redirect URI</span>
            {authState?.redirectUri ? <CopyField value={authState.redirectUri} /> : <Skeleton rows={1} />}
            <span className="muted">Add this exact URI under OAuth 2 → Redirect URIs in your Dropbox app console.</span>
          </div>
        </section>
      </div>

      <div id="recent-saves" style={{ scrollMarginTop: 16 }}>
        <RecentSaves items={recentSaves} />
      </div>

      <footer className="muted page-footer">
        Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc.
      </footer>
    </div>
  );
}
