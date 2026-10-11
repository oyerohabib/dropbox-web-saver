import { useEffect, useState } from "react";
import { RecentSaves } from "../../components/RecentSaves";
import { sendBackgroundMessage } from "../../lib/browser";
import type {
  DropboxAuthState,
  ExtensionSettings,
  RecentSaveRecord,
  SavePreferences,
} from "../../lib/types";

export function OptionsApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [appKeyDraft, setAppKeyDraft] = useState("");
  const [preferencesDraft, setPreferencesDraft] = useState<SavePreferences | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  async function saveAppKey() {
    try {
      const nextSettings = await sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: {
          appKey: appKeyDraft.trim() || null,
        },
      });
      setSettings(nextSettings);
      setMessage("Dropbox app key saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the Dropbox app key.");
    }
  }

  async function connect() {
    try {
      await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
      setMessage("Dropbox connected.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dropbox connection failed.");
    }
  }

  async function disconnect() {
    try {
      await sendBackgroundMessage<{ ok: true }>({ type: "DISCONNECT_DROPBOX" });
      setMessage("Dropbox disconnected.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect Dropbox.");
    }
  }

  async function savePreferences() {
    if (!preferencesDraft) return;
    try {
      const nextSettings = await sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: {
          savePreferences: preferencesDraft,
        },
      });
      setSettings(nextSettings);
      setPreferencesDraft(nextSettings.savePreferences);
      setMessage("Save preferences updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your preferences.");
    }
  }

  return (
    <div className="app-shell">
      <section className="hero">
        <div className="eyebrow">Settings</div>
        <h1>Configure the Dropbox app and connection once, then save from anywhere.</h1>
        <p>
          Add the redirect URI below to your Dropbox app console before you connect this extension.
        </p>
      </section>

      {message ? <div className="callout info">{message}</div> : null}

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
          <button className="primary-button" onClick={() => void saveAppKey()} type="button">
            Save App Key
          </button>
          <div className="muted">Redirect URI</div>
          <div className="path-pill">{authState?.redirectUri || "Loading..."}</div>
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
            <button
              className="primary-button"
              disabled={!settings?.appKey}
              onClick={() => void connect()}
              type="button"
            >
              Connect Dropbox
            </button>
            <button className="secondary-button" onClick={() => void disconnect()} type="button">
              Disconnect
            </button>
            <button
              className="ghost-button"
              onClick={() => chrome.windows.create({ url: chrome.runtime.getURL("save.html"), type: "popup", width: 560, height: 820 })}
              type="button"
            >
              Open Save Window
            </button>
          </div>
        </section>

        <section className="panel stack">
          <div className="section-title">Save Preferences</div>
          <label className="stack">
            <span className="muted">Save mode</span>
            <select
              className="text-input"
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
              className="text-input"
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
          <button
            className="primary-button"
            disabled={!preferencesDraft}
            onClick={() => void savePreferences()}
            type="button"
          >
            Save Preferences
          </button>
        </section>
      </div>

      <RecentSaves items={recentSaves} />
    </div>
  );
}
