import { DropboxMark } from "./BrandMarks";
import { Button, StatusMessage } from "./ui";
import type { DropboxAuthState } from "../lib/types";

interface DropboxConnectCardProps {
  authState: DropboxAuthState;
  connecting?: boolean;
  disconnecting?: boolean;
  error?: string | null;
  layout?: "page" | "popup";
  ownAppOpen?: boolean;
  ownAppAsLink?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onUseOwnApp?: () => void;
}

export function DropboxConnectCard({
  authState,
  connecting = false,
  disconnecting = false,
  error = null,
  layout = "page",
  ownAppOpen = false,
  ownAppAsLink = false,
  onConnect,
  onDisconnect,
  onUseOwnApp,
}: DropboxConnectCardProps) {
  const signedIn = authState.status === "signed_in";
  const missingKey = authState.status === "missing_app_key";
  const ownAppLabel = ownAppOpen
    ? "Hide your own Dropbox app"
    : authState.appKeySource === "personal"
      ? "Change your Dropbox app"
      : ownAppAsLink
        ? "Use your own Dropbox app (much longer)"
        : "Use your own Dropbox app";
  const showOwnAppButton = Boolean(onUseOwnApp) && !ownAppAsLink && !(missingKey && ownAppOpen);
  const showOwnAppLink = Boolean(onUseOwnApp) && ownAppAsLink;

  if (layout === "popup" && signedIn) {
    return (
      <div className="stack">
        <div className="row row-between">
          <span className="muted truncate">
            Dropbox{authState.accountEmail ? ` · ${authState.accountEmail}` : ""}
          </span>
          {onDisconnect ? (
            <Button loading={disconnecting} onClick={onDisconnect} variant="ghost">
              Disconnect
            </Button>
          ) : null}
        </div>
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row row-between">
        <div className="section-title">{signedIn ? "Dropbox" : "Connect Dropbox"}</div>
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
          : missingKey
            ? "Add your own Dropbox app key in settings to connect."
            : "Sign in, then click Allow."}
      </div>

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="actions-wrap">
        {signedIn && onDisconnect ? (
          <Button loading={disconnecting} onClick={onDisconnect} variant="ghost">
            Disconnect
          </Button>
        ) : null}
        {!signedIn && !missingKey && onConnect ? (
          <Button
            block
            className="brand-connect-button dropbox"
            large
            loading={connecting}
            onClick={onConnect}
          >
            {!connecting ? <DropboxMark /> : null}
            Connect Dropbox
          </Button>
        ) : null}
        {showOwnAppButton ? (
          <Button
            block={layout === "popup"}
            large={missingKey}
            onClick={onUseOwnApp}
            variant={missingKey ? "primary" : "secondary"}
          >
            {ownAppLabel}
          </Button>
        ) : null}
      </div>

      {showOwnAppLink ? (
        <div className="muted">
          <button className="link-button" onClick={onUseOwnApp} type="button">
            {ownAppLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
