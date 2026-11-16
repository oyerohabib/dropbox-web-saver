import { Button, StatusMessage } from "./ui";
import type { DropboxAuthState } from "../lib/types";

interface DropboxConnectCardProps {
  authState: DropboxAuthState;
  connecting?: boolean;
  disconnecting?: boolean;
  error?: string | null;
  layout?: "page" | "popup";
  ownAppOpen?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onUseOwnApp?: () => void;
}

function appSourceLine(authState: DropboxAuthState): string | null {
  if (authState.appKeySource === "personal") return "Using your own Dropbox app.";
  if (authState.appKeySource === "builtin") return "Using Web Saver's Dropbox app.";
  return null;
}

export function DropboxConnectCard({
  authState,
  connecting = false,
  disconnecting = false,
  error = null,
  layout = "page",
  ownAppOpen = false,
  onConnect,
  onDisconnect,
  onUseOwnApp,
}: DropboxConnectCardProps) {
  const signedIn = authState.status === "signed_in";
  const missingKey = authState.status === "missing_app_key";
  const sourceLine = appSourceLine(authState);

  if (layout === "popup" && signedIn) {
    return (
      <div className="stack">
        <div className="row row-between">
          <span className="muted truncate">
            Signed in{authState.accountEmail ? ` as ${authState.accountEmail}` : ""}
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
        <div className="section-title">{signedIn ? "Dropbox connection" : "Connect Dropbox"}</div>
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
            ? "This copy of Web Saver has no Dropbox app key. Create your own Dropbox app to connect."
            : "A Dropbox window opens. Sign in if asked, then click Allow. This usually takes about 5 seconds."}
      </div>

      {sourceLine ? <div className="muted">{sourceLine}</div> : null}

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="actions-wrap">
        {signedIn && onDisconnect ? (
          <Button loading={disconnecting} onClick={onDisconnect} variant="ghost">
            Disconnect
          </Button>
        ) : null}
        {!signedIn && !missingKey && onConnect ? (
          <Button block={layout === "popup"} large loading={connecting} onClick={onConnect}>
            Connect Dropbox
          </Button>
        ) : null}
        {onUseOwnApp && !(missingKey && ownAppOpen) ? (
          <Button
            block={layout === "popup"}
            large={missingKey}
            onClick={onUseOwnApp}
            variant={missingKey ? "primary" : "secondary"}
          >
            {ownAppOpen
              ? "Hide your own Dropbox app"
              : authState.appKeySource === "personal"
                ? "Change your Dropbox app"
                : "Use your own Dropbox app"}
          </Button>
        ) : null}
      </div>

      <div className="muted">
        Tokens stay in this browser. There is no Web Saver server.{" "}
        <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
      </div>
    </div>
  );
}
