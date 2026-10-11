import { useEffect, useState } from "react";
import { RecentSaves } from "../../components/RecentSaves";
import { sendBackgroundMessage } from "../../lib/browser";
import type {
  DropboxAuthState,
  ExtensionSettings,
  RecentSaveRecord,
  StartScanFlowResponse,
} from "../../lib/types";

export function PopupApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    void load();
  }, []);

  async function startScanFlow() {
    setLoadingScan(true);
    try {
      const response = await sendBackgroundMessage<StartScanFlowResponse>({
        type: "START_SCAN_FLOW",
      });
      if (!response.ok) {
        setMessage(response.message);
      } else {
        window.close();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the page scan.");
    } finally {
      setLoadingScan(false);
    }
  }

  return (
    <div className="app-shell">
      <section className="hero">
        <div className="eyebrow">Dropbox Web Saver</div>
        <h2>Find files on the page, review the destination, and save them into Dropbox.</h2>
        <p>
          {authState?.status === "signed_in"
            ? `Connected${authState.accountEmail ? ` as ${authState.accountEmail}` : ""}.`
            : "Dropbox is not connected yet."}
        </p>
      </section>

      <section className="panel stack">
        <div className="row row-between">
          <div>
            <div className="section-title">Find Assets On This Page</div>
            <div className="muted">
              Scan the current tab for images, videos, audio files, and linked downloads.
            </div>
          </div>
        </div>
        <button className="primary-button" onClick={() => void startScanFlow()} type="button">
          {loadingScan ? "Opening scan..." : "Scan Page Assets"}
        </button>
        <div className="muted">
          Default folder: {settings?.lastUsedFolderPath || "No default folder chosen yet"}
        </div>
        {message ? <div className="callout info">{message}</div> : null}
      </section>

      <section className="panel">
        <div className="row row-between">
          <div>
            <div className="section-title">Quick Actions</div>
            <div className="muted">Change the remembered folder or update Dropbox settings.</div>
          </div>
          <div className="actions-wrap">
            <button
              className="secondary-button"
              onClick={() => {
                void sendBackgroundMessage({ type: "OPEN_FOLDER_SETTINGS" }).then(() => window.close());
              }}
              type="button"
            >
              Choose Folder
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                chrome.runtime.openOptionsPage();
                window.close();
              }}
              type="button"
            >
              Settings
            </button>
          </div>
        </div>
      </section>

      <RecentSaves items={recentSaves} />
    </div>
  );
}
