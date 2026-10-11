import { useEffect, useState } from "react";
import { PreferencesForm } from "../../components/PreferencesForm";
import { RecentSaves } from "../../components/RecentSaves";
import { Button, StatusMessage } from "../../components/ui";
import { openFeedbackTab, openPreferencesTab, openSettingsTab, sendBackgroundMessage } from "../../lib/browser";
import type {
  DropboxAuthState,
  RecentSaveRecord,
  StartScanFlowResponse,
} from "../../lib/types";

const POPUP_RECENT_LIMIT = 5;

export function PopupApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [nextAuthState, nextRecentSaves] = await Promise.all([
      sendBackgroundMessage<DropboxAuthState>({ type: "GET_AUTH_STATE" }),
      sendBackgroundMessage<RecentSaveRecord[]>({ type: "GET_RECENT_SAVES" }),
    ]);
    setAuthState(nextAuthState);
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

  const signedIn = authState?.status === "signed_in";

  return (
    <div className="app-shell popup">
      <header className="app-header">
        <div className="brand">
          <img alt="" src="/icons/48.png" />
          <span className="truncate">Web Saver for Dropbox</span>
        </div>
        <div className="row">
          {authState ? (
            <span
              className={`badge ${signedIn ? "success" : "neutral"}`}
              title={signedIn ? authState.accountEmail ?? undefined : undefined}
            >
              <span className="status-dot" />
              {signedIn ? "Connected" : "Not connected"}
            </span>
          ) : null}
          <Button
            aria-label="Save preferences"
            onClick={() => void openPreferencesTab().then(() => window.close())}
            title="Save preferences"
            variant="icon"
          >
            ⚙
          </Button>
        </div>
      </header>

      {authState && !signedIn ? (
        <section className="panel stack">
          <div>
            <div className="section-title">
              {authState.status === "missing_app_key" ? "Finish setting up" : "Reconnect Dropbox"}
            </div>
            <div className="muted">
              {authState.status === "missing_app_key"
                ? "Create your own Dropbox app and connect it. A guide walks you through it."
                : "Your app key is saved. Connect your Dropbox account to start saving."}
            </div>
          </div>
          <Button block large onClick={() => void openSettingsTab("setup").then(() => window.close())}>
            {authState.status === "missing_app_key" ? "Set up Dropbox (5 steps, about 3 minutes)" : "Connect Dropbox"}
          </Button>
          <div className="muted">
            🔒 Your key stays on this computer.{" "}
            <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
          </div>
        </section>
      ) : null}

      <section className="panel stack">
        <div>
          <div className="section-title">Find files on this page</div>
          <div className="muted">Images, videos, audio, and linked downloads.</div>
        </div>
        <Button block large loading={loadingScan} onClick={() => void startScanFlow()}>
          {loadingScan ? "Scanning page…" : "Scan this page"}
        </Button>
        {message ? <StatusMessage tone="error">{message}</StatusMessage> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="section-title">How saving works</div>
          <button
            className="link-button"
            onClick={() => void openPreferencesTab().then(() => window.close())}
            type="button"
          >
            All preferences
          </button>
        </div>
        <PreferencesForm
          onChooseFolder={() => {
            void sendBackgroundMessage({ type: "OPEN_FOLDER_SETTINGS" }).then(() => window.close());
          }}
          variant="compact"
        />
      </section>

      <RecentSaves
        items={recentSaves}
        limit={POPUP_RECENT_LIMIT}
        onViewAll={() => {
          void openSettingsTab("recent-saves").then(() => window.close());
        }}
      />

      <footer className="muted page-footer">
        <button className="link-button" onClick={() => void openFeedbackTab().then(() => window.close())} type="button">
          Send feedback
        </button>
        {" · "}
        <button
          className="link-button"
          onClick={() => void openFeedbackTab({ kind: "bug" }).then(() => window.close())}
          type="button"
        >
          Report a bug
        </button>
      </footer>
    </div>
  );
}
