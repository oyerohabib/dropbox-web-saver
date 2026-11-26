import { useEffect, useState } from "react";
import { DropboxConnectCard } from "../../components/DropboxConnectCard";
import { GoogleDriveConnectCard } from "../../components/GoogleDriveConnectCard";
import { PreferencesForm } from "../../components/PreferencesForm";
import { RecentSaves } from "../../components/RecentSaves";
import { Button, StatusMessage } from "../../components/ui";
import { openFeedbackTab, openPreferencesTab, openSettingsTab, sendBackgroundMessage } from "../../lib/browser";
import { PRODUCT_NAME } from "../../lib/project";
import type {
  CombinedAuthState,
  DropboxAuthState,
  GoogleDriveAuthState,
  RecentSaveRecord,
  StartScanFlowResponse,
} from "../../lib/types";

const POPUP_RECENT_LIMIT = 5;

export function PopupApp() {
  const [combinedAuth, setCombinedAuth] = useState<CombinedAuthState | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [connectingDropbox, setConnectingDropbox] = useState(false);
  const [disconnectingDropbox, setDisconnectingDropbox] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [nextAuthState, nextRecentSaves] = await Promise.all([
      sendBackgroundMessage<CombinedAuthState>({ type: "GET_COMBINED_AUTH_STATE" }),
      sendBackgroundMessage<RecentSaveRecord[]>({ type: "GET_RECENT_SAVES" }),
    ]);
    setCombinedAuth(nextAuthState);
    setRecentSaves(nextRecentSaves);
  }

  useEffect(() => {
    void load();
  }, []);

  async function connectDropbox() {
    setConnectingDropbox(true);
    setAuthError(null);
    try {
      await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
      await load();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Dropbox connection failed.");
    } finally {
      setConnectingDropbox(false);
    }
  }

  async function disconnectDropbox() {
    setDisconnectingDropbox(true);
    setAuthError(null);
    try {
      await sendBackgroundMessage<{ ok: true }>({ type: "DISCONNECT_DROPBOX" });
      await load();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not disconnect Dropbox.");
    } finally {
      setDisconnectingDropbox(false);
    }
  }

  async function connectDrive() {
    setConnectingDrive(true);
    setAuthError(null);
    try {
      await sendBackgroundMessage<GoogleDriveAuthState>({ type: "CONNECT_GOOGLE_DRIVE" });
      await load();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google Drive connection failed.");
    } finally {
      setConnectingDrive(false);
    }
  }

  async function disconnectDrive() {
    setDisconnectingDrive(true);
    setAuthError(null);
    try {
      await sendBackgroundMessage<{ ok: true }>({ type: "DISCONNECT_GOOGLE_DRIVE" });
      await load();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not disconnect Google Drive.");
    } finally {
      setDisconnectingDrive(false);
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

  const dropboxSignedIn = combinedAuth?.dropbox.status === "signed_in";
  const driveSignedIn = combinedAuth?.googleDrive.status === "signed_in";
  const anySignedIn = dropboxSignedIn || driveSignedIn;

  return (
    <div className="app-shell popup">
      <header className="app-header">
        <div className="brand">
          <img alt="" src="/icons/48.png" />
          <span className="truncate">{PRODUCT_NAME}</span>
        </div>
        <div className="row">
          {combinedAuth ? (
            <span
              className={`badge ${anySignedIn ? "success" : "neutral"}`}
              title={
                [
                  dropboxSignedIn ? combinedAuth.dropbox.accountEmail : null,
                  driveSignedIn ? combinedAuth.googleDrive.accountEmail : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            >
              <span className="status-dot" />
              {anySignedIn ? "Connected" : "Not connected"}
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

      {combinedAuth ? (
        <section className="panel stack">
          <DropboxConnectCard
            authState={combinedAuth.dropbox}
            connecting={connectingDropbox}
            disconnecting={disconnectingDropbox}
            error={authError}
            layout="popup"
            onConnect={() => void connectDropbox()}
            onDisconnect={() => void disconnectDropbox()}
            onUseOwnApp={
              combinedAuth.dropbox.status === "missing_app_key"
                ? () => void openSettingsTab("setup").then(() => window.close())
                : undefined
            }
          />
          <GoogleDriveConnectCard
            authState={combinedAuth.googleDrive}
            connecting={connectingDrive}
            disconnecting={disconnectingDrive}
            layout="popup"
            onConnect={() => void connectDrive()}
            onDisconnect={() => void disconnectDrive()}
          />
          <div className="muted connect-privacy">
            Tokens stay in this browser.{" "}
            <a href="/privacy.html" rel="noopener" target="_blank">Privacy</a>
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
