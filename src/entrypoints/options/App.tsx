import { useEffect, useRef, useState } from "react";
import { DropboxConnectCard } from "../../components/DropboxConnectCard";
import { PreferencesForm } from "../../components/PreferencesForm";
import { RecentSaves } from "../../components/RecentSaves";
import { SetupWizard } from "../../components/SetupWizard";
import { WalkthroughCard } from "../../components/WalkthroughCard";
import { Skeleton, StatusMessage, type StatusTone } from "../../components/ui";
import { sendBackgroundMessage } from "../../lib/browser";
import { REPO_URL } from "../../lib/project";
import { SUPPORTED_FILE_TYPES } from "../../lib/utils/file-types";
import type {
  DropboxAuthState,
  ExtensionSettings,
  RecentSaveRecord,
} from "../../lib/types";

type BusyAction = "connect" | "disconnect";

export function OptionsApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([]);
  const [showOwnApp, setShowOwnApp] = useState(window.location.hash === "#setup");
  const [message, setMessage] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const hero = heroRef.current;
    const nav = navRef.current;
    if (!page || !hero || !nav) return;
    const syncStickyOffsets = () => {
      page.style.setProperty("--settings-hero-height", `${hero.offsetHeight}px`);
      page.style.setProperty("--settings-nav-height", `${nav.offsetHeight}px`);
    };
    syncStickyOffsets();
    const observer = new ResizeObserver(syncStickyOffsets);
    observer.observe(hero);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

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
    void load().then(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || !preferencesReady || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loaded, preferencesReady]);

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

  function disconnect() {
    return runAction(
      "disconnect",
      () => sendBackgroundMessage<{ ok: true }>({ type: "DISCONNECT_DROPBOX" }),
      "Dropbox disconnected.",
      "Could not disconnect Dropbox.",
    );
  }

  function connect() {
    return runAction(
      "connect",
      () => sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" }),
      "Dropbox connected.",
      "Could not connect Dropbox.",
    );
  }

  async function setWalkthroughHidden(hidden: boolean) {
    try {
      const nextSettings = await sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: { walkthroughHidden: hidden },
      });
      setSettings(nextSettings);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update the walkthrough.",
      });
    }
  }

  async function clearHistory() {
    if (!window.confirm("Clear your recent saves history? Files already in Dropbox are not affected.")) return;
    setClearingHistory(true);
    try {
      await sendBackgroundMessage<{ ok: true }>({ type: "CLEAR_RECENT_SAVES" });
      setRecentSaves([]);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not clear history." });
    } finally {
      setClearingHistory(false);
    }
  }

  const signedIn = authState?.status === "signed_in";
  const missingKey = authState?.status === "missing_app_key";

  useEffect(() => {
    if (missingKey) setShowOwnApp(true);
  }, [missingKey]);

  const connectionSection = authState ? (
    <section className="panel stack" id="connection">
      <DropboxConnectCard
        authState={authState}
        connecting={busyAction === "connect"}
        disconnecting={busyAction === "disconnect"}
        ownAppOpen={showOwnApp}
        onConnect={() => void connect()}
        onDisconnect={() => void disconnect()}
        onUseOwnApp={() => setShowOwnApp((current) => !current)}
        ownAppAsLink={!missingKey}
      />
    </section>
  ) : null;

  const setupSection = (
    <section className="panel" id="setup">
      <div className="panel-header">
        <div>
          <div className="section-title">Your own Dropbox app</div>
          <div className="muted">
            {missingKey
              ? "Create a Dropbox app in your account and paste its app key. That is how this copy of Web Saver connects."
              : "Optional, and it takes about 3 minutes. A Dropbox app you create is used instead of Web Saver's app. Your key stays in this browser."}
          </div>
        </div>
      </div>
      <SetupWizard appKey={settings?.appKey ?? null} authState={authState} onChange={load} />
    </section>
  );

  const dropboxSections = (
    <>
      {connectionSection}
      {showOwnApp ? setupSection : null}
    </>
  );

  return (
    <div className="app-shell page settings-page" ref={pageRef}>
      <section className="hero" ref={heroRef}>
        <div className="row" style={{ gap: 12 }}>
          <img alt="" src="/icons/48.png" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <div className="eyebrow">Web Saver for Dropbox</div>
            <h1>Settings</h1>
          </div>
        </div>
        <p>
          {authState && !signedIn
            ? missingKey
              ? "Add your own Dropbox app below to start saving. Everything stays in this browser."
              : "Connect Dropbox to start saving. It usually takes about 5 seconds."
            : "Choose how saving works, manage your Dropbox connection, and review recent saves."}
          {settings?.walkthroughHidden ? (
            <>
              {" "}
              <button className="link-button" onClick={() => void setWalkthroughHidden(false)} type="button">
                Watch the walkthrough
              </button>
            </>
          ) : null}
        </p>
      </section>

      {settings && !settings.walkthroughHidden ? (
        <WalkthroughCard onHide={() => void setWalkthroughHidden(true)} />
      ) : null}

      <nav aria-label="Settings sections" className="page-nav" ref={navRef}>
        {authState ? <a href="#connection">Dropbox</a> : null}
        <a href="#preferences">Save preferences</a>
        <a href="#supported-files">Supported files</a>
        <a href="#recent-saves">Recent saves</a>
      </nav>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

      {!authState ? <Skeleton rows={4} /> : null}

      {authState && !signedIn ? dropboxSections : null}

      <section className="panel" id="preferences">
        <div className="panel-header">
          <div>
            <div className="section-title">Save preferences</div>
            <div className="muted">Changes save automatically.</div>
          </div>
        </div>
        <PreferencesForm
          onChooseFolder={() => void sendBackgroundMessage({ type: "OPEN_FOLDER_SETTINGS" })}
          onReady={() => setPreferencesReady(true)}
          variant="full"
        />
      </section>

      {signedIn ? dropboxSections : null}

      <section className="panel stack" id="supported-files">
        <div>
          <div className="section-title">Supported files</div>
          <div className="muted">
            Right-click any image, video, or audio on a page to save it, whatever its format. Links and page scans
            recognise these file types:
          </div>
        </div>
        <dl className="file-types">
          {SUPPORTED_FILE_TYPES.map((group) => (
            <div className="file-types-row" key={group.label}>
              <dt>{group.label}</dt>
              <dd>{group.extensions.join(", ")}</dd>
            </div>
          ))}
        </dl>
        <div className="muted">
          Links to other files still work when the site serves them as a download. Streamed video (such as YouTube)
          can&apos;t be saved.
        </div>
      </section>

      <div id="recent-saves">
        <RecentSaves
          clearing={clearingHistory}
          items={recentSaves}
          onClear={() => void clearHistory()}
        />
      </div>

      <footer className="muted page-footer">
        Web Saver for Dropbox is an independent project and is not affiliated with or endorsed by Dropbox, Inc.
        {" · "}
        <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
        <div className="actions-wrap footer-links">
          <a href="/feedback.html" rel="noopener" target="_blank">Send feedback</a>
          <a href="/feedback.html?kind=bug" rel="noopener" target="_blank">Report a bug</a>
          <a href={REPO_URL} rel="noopener noreferrer" target="_blank">Source on GitHub</a>
        </div>
      </footer>
    </div>
  );
}
