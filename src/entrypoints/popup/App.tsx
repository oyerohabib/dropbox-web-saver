import { useEffect, useState } from "react";
import { DropboxConnectCard } from "../../components/DropboxConnectCard";
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
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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

  async function connect() {
    setConnecting(true);
    setAuthError(null);
    try {
      await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
      await load();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Dropbox connection failed.");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setAuthError(null);
    try {
      await sendBackgroundMessage<{ ok: true }>({ type: "DISCONNECT_DROPBOX" });
      await load();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not disconnect Dropbox.");
    } finally {
      setDisconnecting(false);
    }
  }

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

      {authState ? (
        <section className="panel stack">
          <DropboxConnectCard
            authState={authState}
            connecting={connecting}
            disconnecting={disconnecting}
            error={authError}
            layout="popup"
            onConnect={() => void connect()}
            onDisconnect={() => void disconnect()}
            onUseOwnApp={
              authState.status === "missing_app_key"
                ? () => void openSettingsTab("setup").then(() => window.close())
                : undefined
            }
          />
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
