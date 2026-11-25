import { GoogleDriveMark } from "./BrandMarks";
import { Button, StatusMessage } from "./ui";
import type { GoogleDriveAuthState } from "../lib/types";

interface GoogleDriveConnectCardProps {
  authState: GoogleDriveAuthState;
  connecting?: boolean;
  disconnecting?: boolean;
  error?: string | null;
  layout?: "page" | "popup";
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function GoogleDriveConnectCard({
  authState,
  connecting = false,
  disconnecting = false,
  error = null,
  layout = "page",
  onConnect,
  onDisconnect,
}: GoogleDriveConnectCardProps) {
  const signedIn = authState.status === "signed_in";
  const missingClientId = authState.status === "missing_client_id";
  const needsReconnect = Boolean(signedIn && authState.needsReconnect);

  if (layout === "popup" && signedIn) {
    return (
      <div className="stack">
        <div className="row row-between">
          <span className="muted truncate">
            Google Drive{authState.accountEmail ? ` · ${authState.accountEmail}` : ""}
          </span>
          {onDisconnect ? (
            <Button loading={disconnecting} onClick={onDisconnect} variant="ghost">
              Disconnect
            </Button>
          ) : null}
        </div>
        {needsReconnect ? (
          <StatusMessage tone="warning">
            Reconnect to browse folders already in your Drive.
          </StatusMessage>
        ) : null}
        {needsReconnect && onConnect ? (
          <Button
            block
            className="brand-connect-button google-drive"
            loading={connecting}
            onClick={onConnect}
          >
            {!connecting ? <GoogleDriveMark /> : null}
            Reconnect Google Drive
          </Button>
        ) : null}
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row row-between">
        <div className="section-title">{signedIn ? "Google Drive" : "Connect Google Drive"}</div>
        {signedIn ? (
          <span className="badge success">
            <span className="status-dot" />
            Connected
          </span>
        ) : null}
      </div>

      <div className="muted break-anywhere">
        {signedIn
          ? `Signed in${authState.accountEmail ? ` as ${authState.accountEmail}` : ""}.`
          : missingClientId
            ? "Google Drive is not configured in this build."
            : "Sign in, then allow access."}
      </div>

      {needsReconnect ? (
        <StatusMessage tone="warning">
          Reconnect to browse folders already in your Drive.
        </StatusMessage>
      ) : null}

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="actions-wrap">
        {signedIn && onDisconnect ? (
          <Button loading={disconnecting} onClick={onDisconnect} variant="ghost">
            Disconnect
          </Button>
        ) : null}
        {((!signedIn && !missingClientId) || needsReconnect) && onConnect ? (
          <Button
            block
            className="brand-connect-button google-drive"
            large
            loading={connecting}
            onClick={onConnect}
          >
            {!connecting ? <GoogleDriveMark /> : null}
            {needsReconnect ? "Reconnect Google Drive" : "Connect Google Drive"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
