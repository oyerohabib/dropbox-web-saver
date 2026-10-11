import { useEffect, useState } from "react";
import { RecentSaves } from "../../components/RecentSaves";
import { Button, CopyField, Skeleton, StatusMessage, type StatusTone } from "../../components/ui";
import { sendBackgroundMessage } from "../../lib/browser";
import type {
  DropboxAuthState,
  ExtensionSettings,
  RecentSaveRecord,
  SavePreferences,
} from "../../lib/types";

type BusyAction = "appKey" | "connect" | "disconnect" | "preferences";

export function OptionsApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [appKeyDraft, setAppKeyDraft] = useState("");
  const [preferencesDraft, setPreferencesDraft] = useState<SavePreferences | null>(null);
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
    setPreferencesDraft(nextSettings.savePreferences);
    setRecentSaves(nextRecentSaves);
  }

  useEffect(() => {
    void load();
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

  function savePreferences() {
    if (!preferencesDraft) return;
    return runAction(
      "preferences",
      () => sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: { savePreferences: preferencesDraft },
      }),
      "Save preferences updated.",
      "Could not save your preferences.",
    );
  }

  return (
    <div className="app-shell page">
      <section className="hero">
        <div className="eyebrow">Settings</div>
        <h1>Configure the Dropbox app and connection once, then save from anywhere.</h1>
        <p>
          Add the redirect URI below to your Dropbox app console before you connect this extension.
        </p>
      </section>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

      <div className="options-grid">
        <section className="panel stack">
          <div className="section-title">Dropbox App</div>
          <label className="stack">
            <span className="muted">App key</span>
            <input
              className="text-input"
              onChange={(event) => setAppKeyDraft(event.target.value)}
              placeholder="Paste your Dropbox app key"
              value={appKeyDraft}
            />
          </label>
          <Button loading={busyAction === "appKey"} onClick={() => void saveAppKey()}>
            Save App Key
          </Button>
          <div className="field">
            <span className="field-label">Redirect URI</span>
            {authState?.redirectUri ? <CopyField value={authState.redirectUri} /> : <Skeleton rows={1} />}
            <span className="muted">Add this exact URI under OAuth 2 → Redirect URIs in your Dropbox app console.</span>
          </div>
        </section>

        <section className="panel stack">
          <div className="section-title">Connection</div>
          <div className="muted">
            Status: {authState?.status === "signed_in" ? "Connected" : authState?.status || "Loading"}
          </div>
          <div className="muted">
            Account: {authState?.accountEmail || "Not connected"}
          </div>
          <div className="muted">
            Last folder: {settings?.lastUsedFolderPath || "No folder selected yet"}
          </div>
          <div className="actions-wrap">
            <Button
              disabled={!settings?.appKey}
              loading={busyAction === "connect"}
              onClick={() => void connect()}
            >
              Connect Dropbox
            </Button>
            <Button loading={busyAction === "disconnect"} onClick={() => void disconnect()} variant="secondary">
              Disconnect
            </Button>
            <Button
              onClick={() => void sendBackgroundMessage({ type: "OPEN_FOLDER_SETTINGS" })}
              variant="ghost"
            >
              Choose Default Folder
            </Button>
          </div>
        </section>

        <section className="panel stack">
          <div className="section-title">Save Preferences</div>
          <label className="stack">
            <span className="muted">Save mode</span>
            <select
              className="select-input"
              onChange={(event) =>
                setPreferencesDraft((current) =>
                  current
                    ? {
                        ...current,
                        saveMode: event.target.value as SavePreferences["saveMode"],
                      }
                    : current,
                )}
              value={preferencesDraft?.saveMode || "reviewed"}
            >
              <option value="reviewed">Reviewed save</option>
              <option value="one_click">One-click save</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Folder choice</span>
            <select
              className="select-input"
              onChange={(event) =>
                setPreferencesDraft((current) =>
                  current
                    ? {
                        ...current,
                        folderBehavior: event.target.value as SavePreferences["folderBehavior"],
                      }
                    : current,
                )}
              value={preferencesDraft?.folderBehavior || "remember_last"}
            >
              <option value="remember_last">Remember last folder</option>
              <option value="always_ask">Ask every time</option>
            </select>
          </label>
          <label className="row">
            <input
              checked={preferencesDraft?.promptForRename || false}
              onChange={(event) =>
                setPreferencesDraft((current) =>
                  current
                    ? {
                        ...current,
                        promptForRename: event.target.checked,
                      }
                    : current,
                )}
              type="checkbox"
            />
            <span className="muted">Prompt me to rename assets before saving</span>
          </label>
          <div className="muted">
            Reviewed save is safer. One-click save skips the review window unless a folder choice or rename prompt still requires your input.
          </div>
          <Button
            disabled={!preferencesDraft}
            loading={busyAction === "preferences"}
            onClick={() => void savePreferences()}
          >
            Save Preferences
          </Button>
        </section>
      </div>

      <RecentSaves items={recentSaves} />

      <footer className="muted page-footer">
        Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc.
      </footer>
    </div>
  );
}
