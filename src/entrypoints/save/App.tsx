import { useEffect, useState } from "react";
import { FolderPicker } from "../../components/FolderPicker";
import { Button, Spinner, StatusMessage, type StatusTone } from "../../components/ui";
import { openFeedbackTab, openPreferencesTab, openSettingsTab, sendBackgroundMessage } from "../../lib/browser";
import { deriveCandidateFilename } from "../../lib/utils/filename";
import { formatFolderPath } from "../../lib/utils/folder-path";
import { getDropboxWebUrl } from "../../lib/utils/url";
import type {
  AssetCandidate,
  DropboxAuthState,
  ExtensionSettings,
  PendingSaveState,
  SavePreferences,
  SaveResult,
} from "../../lib/types";

const SUCCESS_CLOSE_DELAY_MS = 1_200;
const KEPT_REVIEWING_CLOSE_DELAY_MS = 1_800;

function getReviewCandidate(flow: PendingSaveState | null, selectedSourceUrl: string | null): AssetCandidate | null {
  if (!flow) return null;
  if (flow.mode === "single") return flow.request.candidate;
  return flow.assets.find((asset) => asset.sourceUrl === selectedSourceUrl) || flow.assets[0] || null;
}

export function SaveApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [saveFlow, setSaveFlow] = useState<PendingSaveState | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>("/");
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string | null>(null);
  const [filenameDraft, setFilenameDraft] = useState("");
  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTo, setSavedTo] = useState<{ folderPath: string; filename: string; switchedToInstant: boolean } | null>(
    null,
  );
  const [keptReviewing, setKeptReviewing] = useState(false);
  const [keepingReview, setKeepingReview] = useState(false);
  const [changingFolder, setChangingFolder] = useState(false);
  const [savePreferences, setSavePreferences] = useState<SavePreferences | null>(null);
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null);
  const [defaultSaved, setDefaultSaved] = useState(false);

  async function load() {
    const [nextAuthState, nextSaveFlow, settings] = await Promise.all([
      sendBackgroundMessage<DropboxAuthState>({ type: "GET_AUTH_STATE" }),
      sendBackgroundMessage<PendingSaveState | null>({ type: "GET_PENDING_SAVE" }),
      sendBackgroundMessage<ExtensionSettings>({ type: "GET_SETTINGS" }),
    ]);
    setAuthState(nextAuthState);
    setSaveFlow(nextSaveFlow);
    setSavePreferences(settings.savePreferences);
    setDefaultFolder(settings.lastUsedFolderPath);
    setSelectedPath(
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.destinationPath || settings.lastUsedFolderPath || "/"
        : nextSaveFlow?.request.destinationPath || settings.lastUsedFolderPath || "/",
    );
    setSelectedSourceUrl(
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.selectedSourceUrl || nextSaveFlow.assets[0]?.sourceUrl || null
        : nextSaveFlow?.request.candidate.sourceUrl || null,
    );
    const nextCandidate =
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.assets.find((asset) => asset.sourceUrl === nextSaveFlow.selectedSourceUrl)
          || nextSaveFlow.assets[0]
        : nextSaveFlow?.request.candidate;
    const nextResolvedFilename = nextCandidate
      ? deriveCandidateFilename(
          nextCandidate,
          nextSaveFlow?.mode === "single" ? nextSaveFlow.request.finalFilename : null,
        )
      : "";
    setFilenameDraft(
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.selectedFilename || nextResolvedFilename
        : nextSaveFlow?.mode === "single"
          ? nextSaveFlow.request.finalFilename || nextSaveFlow.resolvedFilename || nextResolvedFilename
          : nextResolvedFilename,
    );
    setChangingFolder(
      Boolean(
        settings.savePreferences.folderBehavior === "always_ask"
          || (nextSaveFlow?.mode === "single" && nextSaveFlow.request.forceFolderPicker)
          || (!settings.lastUsedFolderPath
            && !(nextSaveFlow && nextSaveFlow.mode === "single" && nextSaveFlow.request.destinationPath)),
      ),
    );
  }

  useEffect(() => {
    load()
      .catch((error) => {
        setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not load this save." });
      })
      .finally(() => setLoaded(true));
  }, []);

  const reviewCandidate = getReviewCandidate(saveFlow, selectedSourceUrl);
  const resolvedFilename = reviewCandidate ? deriveCandidateFilename(reviewCandidate) : null;
  const shouldPromptForRename = savePreferences?.promptForRename ?? false;

  useEffect(() => {
    if (saveFlow?.mode === "scan" && resolvedFilename) {
      setFilenameDraft(resolvedFilename);
    }
  }, [resolvedFilename, saveFlow?.mode, selectedSourceUrl]);

  async function connect() {
    setConnecting(true);
    try {
      await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
      setStatus({ tone: "success", text: "Dropbox connected." });
      await load();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Dropbox connection failed." });
    } finally {
      setConnecting(false);
    }
  }

  async function saveDefaultFolder(path: string) {
    setSaving(true);
    setStatus(null);
    try {
      await sendBackgroundMessage<ExtensionSettings>({ type: "SET_LAST_USED_FOLDER", path });
      setSelectedPath(path);
      setDefaultFolder(path);
      setDefaultSaved(true);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not save the default folder." });
    } finally {
      setSaving(false);
    }
  }

  async function completeSave() {
    if (!selectedPath || !saveFlow) return;
    try {
      if (!reviewCandidate) {
        setStatus({ tone: "error", text: "No file is selected for saving." });
        return;
      }

      setSaving(true);
      const result = await sendBackgroundMessage<SaveResult>({
        type: "SAVE_PENDING",
        destinationPath: selectedPath,
        candidate: saveFlow.mode === "scan" ? reviewCandidate : undefined,
        finalFilename: filenameDraft.trim() || resolvedFilename,
      });
      if (result.ok) {
        const switchedToInstant = Boolean(result.switchedToInstant);
        setSavedTo({ folderPath: selectedPath, filename: result.filename ?? filenameDraft, switchedToInstant });
        if (!switchedToInstant) {
          setTimeout(() => window.close(), SUCCESS_CLOSE_DELAY_MS);
        }
      } else {
        setStatus({ tone: "error", text: result.message });
        await load();
      }
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "The save request failed." });
    } finally {
      setSaving(false);
    }
  }

  async function keepReviewing() {
    setKeepingReview(true);
    try {
      await sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: { savePreferences: { saveMode: "reviewed" } },
      });
      setKeptReviewing(true);
      setTimeout(() => window.close(), KEPT_REVIEWING_CLOSE_DELAY_MS);
    } catch {
      await openPreferencesTab();
    } finally {
      setKeepingReview(false);
    }
  }

  if (!loaded) {
    return (
      <div className="app-shell save-shell">
        <div className="empty-state row" style={{ justifyContent: "center", border: 0 }}>
          <Spinner size="lg" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (savedTo) {
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className="badge success" style={{ fontSize: 20, padding: "8px 14px" }}>✓</span>
          <div className="section-title">Saved to {formatFolderPath(savedTo.folderPath)}</div>
          <div className="muted break-anywhere">{savedTo.filename}</div>
          <a href={getDropboxWebUrl(savedTo.folderPath)} rel="noopener noreferrer" target="_blank">
            Open in Dropbox
          </a>
          {savedTo.switchedToInstant ? (
            <div className="stack" style={{ width: "100%", textAlign: "left" }}>
              {keptReviewing ? (
                <StatusMessage tone="success">Got it. The review window will keep opening.</StatusMessage>
              ) : (
                <>
                  <StatusMessage tone="info">
                    From now on, saves go straight to <strong>{formatFolderPath(savedTo.folderPath)}</strong> without
                    this window. You&apos;ll see a notice on the page when each one finishes.
                  </StatusMessage>
                  <div className="stack-sm" style={{ alignItems: "center" }}>
                    <Button onClick={() => window.close()}>Done</Button>
                    <button
                      className="link-button"
                      disabled={keepingReview}
                      onClick={() => void keepReviewing()}
                      type="button"
                    >
                      {keepingReview ? "Saving…" : "Keep reviewing each save"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (defaultSaved && defaultFolder) {
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className="badge success" style={{ fontSize: 20, padding: "8px 14px" }}>✓</span>
          <div className="section-title">Default folder set</div>
          <span className="path-pill" title={defaultFolder}>{formatFolderPath(defaultFolder)}</span>
          <div className="muted">
            New saves go here. You can still pick a different folder while saving.
          </div>
          <div className="actions-wrap" style={{ justifyContent: "center" }}>
            <Button onClick={() => window.close()}>Done</Button>
            <Button onClick={() => setDefaultSaved(false)} variant="secondary">
              Choose another folder
            </Button>
          </div>
          <a href={getDropboxWebUrl(defaultFolder)} rel="noopener noreferrer" target="_blank">
            Open in Dropbox
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell save-shell">
      <section className="hero">
        <div className="eyebrow">
          {saveFlow?.mode === "scan" ? "Pick a file from this page" : saveFlow ? "Review save" : "Default folder"}
        </div>
        <h2>
          {saveFlow?.mode === "scan"
            ? "Choose a file from this page to save to Dropbox."
            : saveFlow
              ? "Check the name and folder, then save."
              : "Where should your saves go?"}
        </h2>
        {!saveFlow ? (
          <>
            <p>Open a folder below, then set it as the default. You can still pick another folder while saving.</p>
            <div className="row current-default">
              <span className="muted">Current default</span>
              {defaultFolder ? (
                <span className="path-pill" title={defaultFolder}>{formatFolderPath(defaultFolder)}</span>
              ) : (
                <span className="badge neutral">Not set yet</span>
              )}
            </div>
          </>
        ) : null}
      </section>

      {status ? (
        <StatusMessage tone={status.tone}>
          {status.text}
          {status.tone === "error" ? (
            <>
              {" "}
              <button
                className="link-button"
                onClick={() => void openFeedbackTab({ kind: "bug", message: `Error shown: ${status.text}\n\n` })}
                type="button"
              >
                Report this problem
              </button>
            </>
          ) : null}
        </StatusMessage>
      ) : null}

      {authState?.status !== "signed_in" ? (
        <section className="panel stack">
          <div className="section-title">Connect Dropbox</div>
          <div className="muted">
            {authState?.status === "missing_app_key"
              ? "Web Saver needs a Dropbox app key first. The setup guide walks you through it in about 3 minutes."
              : "Authorize Dropbox to continue."}
          </div>
          <div className="actions-wrap">
            {authState?.status === "missing_app_key" ? (
              <Button onClick={() => void openSettingsTab("setup")}>Open setup guide</Button>
            ) : (
              <>
                <Button loading={connecting} onClick={() => void connect()}>
                  Connect Dropbox
                </Button>
                <Button onClick={() => void openSettingsTab("setup")} variant="secondary">
                  Setup help
                </Button>
              </>
            )}
          </div>
          <div className="muted">
            🔒 Your key stays on this computer.{" "}
            <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
          </div>
        </section>
      ) : null}

      {saveFlow?.mode === "scan" ? (
        <section className="panel stack">
          <div className="row row-between">
            <div>
              <div className="section-title">Files on this page</div>
              <div className="muted">Choose the file you want to save.</div>
            </div>
            <span className="badge neutral">{saveFlow.assets.length} found</span>
          </div>
          <div className="asset-list" style={{ marginTop: 0 }}>
            {saveFlow.assets.map((asset) => {
              const assetFilename = deriveCandidateFilename(asset);
              const isSelected = selectedSourceUrl === asset.sourceUrl;
              return (
                <button
                  aria-pressed={isSelected}
                  className={`asset-row${isSelected ? " selected" : ""}`}
                  key={asset.sourceUrl}
                  onClick={() => setSelectedSourceUrl(asset.sourceUrl)}
                  type="button"
                >
                  <div className="row row-between">
                    <strong className="truncate">{assetFilename}</strong>
                    {isSelected ? <span className="badge accent">Selected</span> : null}
                  </div>
                  <span className="muted truncate" title={asset.sourceUrl}>{asset.sourceUrl}</span>
                  <span className="muted">
                    {asset.detectedType}
                    {asset.requiresAuthenticatedFetch ? " • authenticated fetch" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {reviewCandidate ? (
        <section className="panel stack">
          <div className="row row-between">
            <div className="section-title">Ready to save</div>
            <span className="badge neutral">
              {reviewCandidate.triggerKind === "linked_file" ? "File from link" : "Media asset"}
            </span>
          </div>
          {shouldPromptForRename ? (
            <label className="field">
              <span className="field-label">File name</span>
              <input
                className="text-input"
                onChange={(event) => setFilenameDraft(event.target.value)}
                value={filenameDraft}
              />
            </label>
          ) : resolvedFilename ? (
            <div className="field">
              <span className="field-label">File name</span>
              <strong className="break-anywhere">{resolvedFilename}</strong>
            </div>
          ) : null}
          <div className="muted truncate" title={reviewCandidate.sourceUrl}>
            From {reviewCandidate.sourceUrl}
          </div>
          <div className="row row-between">
            <div className="row" style={{ minWidth: 0 }}>
              <span className="muted">Folder</span>
              <span className="path-pill" title={selectedPath || "/"}>{formatFolderPath(selectedPath || "/")}</span>
            </div>
            {!changingFolder ? (
              <Button onClick={() => setChangingFolder(true)} variant="ghost">
                Change
              </Button>
            ) : null}
          </div>
          <Button
            block
            disabled={!selectedPath}
            large
            loading={saving}
            onClick={() => void completeSave()}
          >
            {saving ? "Saving…" : "Save to Dropbox"}
          </Button>
        </section>
      ) : null}

      {authState?.status === "signed_in" && (!saveFlow || changingFolder || !reviewCandidate) ? (
        <FolderPicker
          confirmLabel={saveFlow ? "Use this folder" : "Set as default folder"}
          confirming={!saveFlow && saving}
          defaultPath={defaultFolder}
          initialPath={selectedPath || "/"}
          onCancel={saveFlow && reviewCandidate ? () => setChangingFolder(false) : undefined}
          onConfirm={(path) => {
            if (!saveFlow) {
              void saveDefaultFolder(path);
              return;
            }
            setSelectedPath(path);
            setChangingFolder(false);
          }}
        />
      ) : null}

      <footer className="page-footer">
        <button className="link-button" onClick={() => void openPreferencesTab()} type="button">
          Change how saving works
        </button>
        <span className="muted">{" · "}</span>
        <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
        <span className="muted">{" · "}</span>
        <button className="link-button" onClick={() => void openFeedbackTab()} type="button">
          Send feedback
        </button>
      </footer>
    </div>
  );
}
